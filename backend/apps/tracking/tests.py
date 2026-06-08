from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.sessions.models import FocusSession

from .models import BrowserEvent, EventBatch, WarningEvent
from .privacy import (
    has_disallowed_fields,
    sanitize_event_payload,
    validate_event_privacy,
)
from .services import EventIngestService


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


class EventBatchIngestApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="tracking@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="tracking-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def create_session(self, user=None, **overrides):
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.DEEP_WORK,
            "goal": "Implement browser event ingest",
            "status": FocusSession.Status.ACTIVE,
            "target_duration_seconds": 3000,
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def valid_event(self, **overrides):
        event = {
            "event_type": "url_change",
            "url": "https://docs.djangoproject.com/en/stable/topics/auth/",
            "domain": "docs.djangoproject.com",
            "page_title": "Django authentication",
            "meta_description": "Django authentication system documentation",
            "content_snippet": "Django comes with a user authentication system...",
            "active_seconds": 45,
            "idle_seconds": 0,
            "tab_switch_count": 1,
        }
        event.update(overrides)
        return event

    def test_valid_batch_creates_batch_and_browser_events(self):
        session = self.create_session()

        response = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {
                "events": [
                    self.valid_event(),
                    self.valid_event(event_type="tab_switch", url="", active_seconds=0),
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        self.assertEqual(response.data["accepted_count"], 2)
        self.assertEqual(response.data["rejected_count"], 0)

        batch = EventBatch.objects.get(pk=response.data["batch_id"])
        self.assertEqual(batch.session_id, session.id)
        self.assertEqual(batch.batch_size, 2)
        self.assertEqual(BrowserEvent.objects.filter(session_id=session.id).count(), 2)

    def test_invalid_and_sensitive_events_are_rejected_without_storing_them(self):
        session = self.create_session()

        response = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {
                "events": [
                    self.valid_event(),
                    self.valid_event(event_type="unsupported"),
                    self.valid_event(password="secret"),
                    self.valid_event(privateMessages=["do not collect"]),
                    self.valid_event(content_snippet="x" * 501),
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["accepted_count"], 1)
        self.assertEqual(response.data["rejected_count"], 4)
        self.assertEqual(BrowserEvent.objects.filter(session_id=session.id).count(), 1)
        self.assertEqual(EventBatch.objects.get().batch_size, 5)

    def test_explicit_sensitive_fields_are_rejected(self):
        session = self.create_session()
        sensitive_fields = [
            "password",
            "passwords",
            "form_input",
            "form_inputs",
            "input_value",
            "input_values",
            "keyboard_input",
            "keystrokes",
            "private_message",
            "private_messages",
            "message_body",
            "email_body",
            "full_page_content",
            "html",
            "raw_html",
            "cookies",
            "local_storage",
            "session_storage",
            "token",
            "access_token",
            "refresh_token",
            "authorization",
        ]
        events = [
            self.valid_event(**{field: "sensitive"})
            for field in sensitive_fields
        ]

        response = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {"events": events},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["accepted_count"], 0)
        self.assertEqual(response.data["rejected_count"], len(sensitive_fields))
        self.assertFalse(BrowserEvent.objects.exists())
        self.assertEqual(EventBatch.objects.get().batch_size, len(sensitive_fields))

    def test_privacy_helpers_report_and_strip_disallowed_fields(self):
        payload = self.valid_event(
            password="secret",
            keyboardInput="typed value",
            localStorage={"token": "abc"},
        )

        is_valid, sanitized, rejected_fields = validate_event_privacy(payload)

        self.assertFalse(is_valid)
        self.assertTrue(has_disallowed_fields(payload))
        self.assertIn("password", rejected_fields)
        self.assertIn("keyboardInput", rejected_fields)
        self.assertIn("localStorage", rejected_fields)
        self.assertEqual(sanitize_event_payload(payload), sanitized)
        self.assertNotIn("password", sanitized)
        self.assertNotIn("keyboardInput", sanitized)
        self.assertNotIn("localStorage", sanitized)

    def test_empty_and_oversized_batches_are_rejected(self):
        session = self.create_session()

        empty = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {"events": []},
            format="json",
        )
        oversized = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {"events": [self.valid_event()] * 101},
            format="json",
        )

        self.assertEqual(empty.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(oversized.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(EventBatch.objects.exists())

    def test_string_lengths_counters_and_url_are_validated(self):
        session = self.create_session()

        response = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {
                "events": [
                    self.valid_event(url="not-a-url"),
                    self.valid_event(url=f"https://example.com/{'x' * 2049}"),
                    self.valid_event(domain="x" * 256),
                    self.valid_event(page_title="x" * 501),
                    self.valid_event(meta_description="x" * 501),
                    self.valid_event(content_snippet="x" * 501),
                    self.valid_event(active_seconds=-1),
                    self.valid_event(idle_seconds=-1),
                    self.valid_event(tab_switch_count=-1),
                    self.valid_event(active_seconds=86401),
                    self.valid_event(idle_seconds=86401),
                    self.valid_event(tab_switch_count=10001),
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["accepted_count"], 0)
        self.assertEqual(response.data["rejected_count"], 12)
        self.assertFalse(BrowserEvent.objects.exists())

    def test_paused_session_rejects_batch(self):
        session = self.create_session(status=FocusSession.Status.PAUSED)

        response = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {"events": [self.valid_event()]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("session_id", response.data)
        self.assertFalse(EventBatch.objects.exists())
        self.assertFalse(BrowserEvent.objects.exists())

    def test_finished_completed_and_cancelled_sessions_reject_batch(self):
        rejected_statuses = [
            FocusSession.Status.COMPLETED,
            FocusSession.Status.CANCELLED,
            "finished",
            "ended",
        ]

        for rejected_status in rejected_statuses:
            with self.subTest(session_status=rejected_status):
                session = self.create_session(status=rejected_status)

                response = self.client.post(
                    f"/api/sessions/{session.id}/events/batch/",
                    {"events": [self.valid_event()]},
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
                self.assertIn("session_id", response.data)
                self.assertFalse(
                    EventBatch.objects.filter(session_id=session.id).exists()
                )
                self.assertFalse(
                    BrowserEvent.objects.filter(session_id=session.id).exists()
                )

    def test_session_owned_by_another_user_rejects_batch(self):
        session = self.create_session(user=self.other_user)

        response = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {"events": [self.valid_event()]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(EventBatch.objects.exists())
        self.assertFalse(BrowserEvent.objects.exists())

    def test_session_not_found_rejects_batch(self):
        missing_session_id = "00000000-0000-0000-0000-000000000000"

        response = self.client.post(
            f"/api/sessions/{missing_session_id}/events/batch/",
            {"events": [self.valid_event()]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(EventBatch.objects.exists())
        self.assertFalse(BrowserEvent.objects.exists())

    def test_session_active_status_compatibility(self):
        active_sessions = [
            SimpleNamespace(status="active"),
            SimpleNamespace(status="ACTIVE"),
            SimpleNamespace(status=FocusSession.Status.ACTIVE),
            SimpleNamespace(state="active"),
            SimpleNamespace(session_status="active"),
        ]
        inactive_sessions = [
            SimpleNamespace(status="paused"),
            SimpleNamespace(status=FocusSession.Status.COMPLETED),
            SimpleNamespace(state="cancelled"),
            SimpleNamespace(session_status="finished"),
            SimpleNamespace(),
        ]

        for session in active_sessions:
            with self.subTest(active_session=session):
                self.assertTrue(EventIngestService.is_session_active(session))

        for session in inactive_sessions:
            with self.subTest(inactive_session=session):
                self.assertFalse(EventIngestService.is_session_active(session))

    def test_endpoint_requires_authentication(self):
        session = self.create_session()
        self.client.force_authenticate(user=None)

        response = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {"events": [self.valid_event()]},
            format="json",
        )

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_missing_focus_session_model_fails_closed(self):
        session = self.create_session()

        with patch(
            "apps.tracking.services.event_ingest_service.apps.get_model",
            side_effect=LookupError,
        ):
            response = self.client.post(
                f"/api/sessions/{session.id}/events/batch/",
                {"events": [self.valid_event()]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(EventBatch.objects.exists())
        self.assertFalse(BrowserEvent.objects.exists())

    def test_warning_event_model_creation(self):
        session = self.create_session()
        browser_event = BrowserEvent.objects.create(
            session_id=session.id,
            event_type="url_change",
            url="https://docs.djangoproject.com/",
            domain="docs.djangoproject.com",
        )

        warning = WarningEvent.objects.create(
            session_id=session.id,
            browser_event=browser_event,
            warning_level=2,
            warning_type=WarningEvent.WarningType.DEEP_WORK_AI,
            domain="docs.djangoproject.com",
            url="https://docs.djangoproject.com/",
            message="Potentially off goal.",
        )

        self.assertIsNotNone(warning.id)
        self.assertEqual(warning.browser_event_id, browser_event.id)
        self.assertEqual(warning.warning_level, 2)
        self.assertEqual(
            warning.warning_type,
            WarningEvent.WarningType.DEEP_WORK_AI,
        )
        self.assertFalse(warning.was_acknowledged)
        self.assertFalse(warning.triggered_auto_pause)
        self.assertIn("Warning L2", str(warning))

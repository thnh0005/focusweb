import uuid
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.ai.models import AIAnalysisResult
from apps.ai.services import AIProviderError
from apps.ai.services.ai_client import AIClient
from apps.extension.models import BlacklistEntry
from apps.sessions.models import FocusSession

from .models import BrowserEvent, EventBatch, WarningCycle, WarningEvent
from .privacy import (
    has_disallowed_fields,
    sanitize_event_payload,
    validate_event_privacy,
)
from .services import (
    BehaviorRuleEngine,
    EventIngestService,
    WarningCycleService,
    normalize_rule_domain,
)


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
        self.assertIn("rule_evaluations", response.data)
        self.assertEqual(len(response.data["rule_evaluations"]), 2)
        self.assertIn("hybrid_decisions", response.data)
        self.assertEqual(len(response.data["hybrid_decisions"]), 2)

    def test_tracking_alias_accepts_extension_event_batch(self):
        session = self.create_session()

        response = self.client.post(
            f"/api/tracking/sessions/{session.id}/events/",
            {"events": [self.valid_event(domain="m.youtube.com")]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["accepted_count"], 1)
        self.assertEqual(BrowserEvent.objects.filter(session_id=session.id).count(), 1)

    def test_tracking_alias_accepts_extension_token_without_cookie_auth(self):
        session = self.create_session()
        token = session.ensure_extension_bridge_token()
        self.client.force_authenticate(user=None)

        response = self.client.post(
            f"/api/tracking/sessions/{session.id}/events/",
            {"events": [self.valid_event(domain="developer.mozilla.org")]},
            format="json",
            HTTP_X_FOCUSOS_SESSION_ID=str(session.id),
            HTTP_X_FOCUSOS_EXTENSION_TOKEN=token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["accepted_count"], 1)
        self.assertEqual(BrowserEvent.objects.filter(session_id=session.id).count(), 1)

    def test_tracking_alias_extension_token_bypasses_session_csrf(self):
        session = self.create_session()
        token = session.ensure_extension_bridge_token()
        csrf_client = APIClient(enforce_csrf_checks=True)
        self.assertTrue(csrf_client.login(email=self.user.email, password=PASSWORD))

        response = csrf_client.post(
            f"/api/tracking/sessions/{session.id}/events/",
            {"events": [self.valid_event(event_type="tab_switch", tab_switch_count=4)]},
            format="json",
            HTTP_ORIGIN="chrome-extension://hjjldlnbhofmlndoabaophfnmdmeigne",
            HTTP_X_FOCUSOS_SESSION_ID=str(session.id),
            HTTP_X_FOCUSOS_EXTENSION_TOKEN=token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["accepted_count"], 1)
        self.assertEqual(BrowserEvent.objects.filter(session_id=session.id).count(), 1)

    @override_settings(
        CSRF_TRUSTED_ORIGINS=[
            "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
        ],
        CORS_ALLOWED_ORIGINS=[
            "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
        ],
    )
    def test_tracking_alias_accepts_trusted_extension_origin_with_csrf(self):
        session = self.create_session()
        csrf_client = APIClient(enforce_csrf_checks=True)
        self.assertTrue(
            csrf_client.login(email=self.user.email, password=PASSWORD)
        )

        csrf_response = csrf_client.get("/api/auth/csrf/")
        csrf_token = csrf_response.data["csrfToken"]
        response = csrf_client.post(
            f"/api/tracking/sessions/{session.id}/events/",
            {"events": [self.valid_event(domain="m.youtube.com")]},
            format="json",
            HTTP_ORIGIN="chrome-extension://abcdefghijklmnopabcdefghijklmnop",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["accepted_count"], 1)
        self.assertEqual(BrowserEvent.objects.filter(session_id=session.id).count(), 1)

    def test_client_event_id_makes_batch_ingest_idempotent(self):
        session = self.create_session()
        client_event_id = str(uuid.uuid4())
        event = self.valid_event(
            clientEventId=client_event_id,
            occurredAt=timezone.now().isoformat(),
        )

        first = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {"events": [event, event]},
            format="json",
        )
        replay = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {"events": [event]},
            format="json",
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["accepted_count"], 1)
        self.assertEqual(first.data["duplicate_count"], 1)
        self.assertEqual(len(first.data["rule_evaluations"]), 1)
        self.assertEqual(replay.status_code, status.HTTP_200_OK)
        self.assertEqual(replay.data["accepted_count"], 0)
        self.assertEqual(replay.data["duplicate_count"], 1)
        self.assertEqual(len(replay.data["rule_evaluations"]), 0)
        self.assertEqual(BrowserEvent.objects.filter(session_id=session.id).count(), 1)

    def test_future_occurred_at_is_rejected_without_storing_event(self):
        session = self.create_session()
        event = self.valid_event(
            clientEventId=str(uuid.uuid4()),
            occurredAt=(timezone.now() + timedelta(days=365)).isoformat(),
        )

        response = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {"events": [event]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["accepted_count"], 0)
        self.assertEqual(response.data["rejected_count"], 1)
        self.assertFalse(BrowserEvent.objects.filter(session_id=session.id).exists())

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

    def test_rule_evaluations_include_blacklist_metadata_and_normal_warning_cycle(self):
        session = self.create_session(mode=FocusSession.Mode.NORMAL)
        BlacklistEntry.objects.create(
            user=self.user,
            domain="youtube.com",
            severity=BlacklistEntry.Severity.HIGH,
        )

        response = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {"events": [self.valid_event(domain="m.youtube.com")]},
            format="json",
        )

        result = response.data["rule_evaluations"][0]["result"]
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(result["risk_level"], "HIGH")
        self.assertTrue(result["should_warn"])
        self.assertEqual(result["blacklist_match"]["domain"], "youtube.com")
        warning_cycle = WarningCycle.objects.get()
        warning = WarningEvent.objects.get()
        self.assertEqual(warning_cycle.mode, FocusSession.Mode.NORMAL)
        self.assertFalse(warning_cycle.auto_pause_required)
        self.assertEqual(warning.warning_level, 1)

    def test_deep_work_blacklist_warning_does_not_call_ai_when_realtime_ai_disabled(self):
        session = self.create_session(mode=FocusSession.Mode.DEEP_WORK)
        BlacklistEntry.objects.create(
            user=self.user,
            domain="youtube.com",
            severity=BlacklistEntry.Severity.HIGH,
        )

        with patch.object(AIClient, "complete_json") as complete_json:
            with patch.object(WarningCycleService, "schedule_advance"):
                response = self.client.post(
                    f"/api/sessions/{session.id}/events/batch/",
                    {"events": [self.valid_event(domain="m.youtube.com")]},
                    format="json",
                )

        result = response.data["hybrid_decisions"][0]["result"]
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complete_json.assert_not_called()
        self.assertEqual(response.data["ai"]["status"], "DISABLED")
        self.assertEqual(result["state"], "DISTRACTED")
        self.assertTrue(result["should_start_warning_cycle"])
        self.assertEqual(WarningCycle.objects.filter(session_id=session.id).count(), 1)
        self.assertEqual(WarningEvent.objects.filter(session_id=session.id).count(), 1)
        self.assertFalse(AIAnalysisResult.objects.exists())

    def test_provider_error_does_not_make_event_ingest_return_500(self):
        session = self.create_session(mode=FocusSession.Mode.DEEP_WORK)

        with patch.object(AIClient, "complete_json", side_effect=AIProviderError()) as complete_json:
            response = self.client.post(
                f"/api/sessions/{session.id}/events/batch/",
                {"events": [self.valid_event()]},
                format="json",
            )

        semantic_result = response.data["semantic_evaluations"][0]["result"]
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complete_json.assert_not_called()
        self.assertEqual(response.data["accepted_count"], 1)
        self.assertEqual(semantic_result["status"], "skipped")
        self.assertFalse(semantic_result["available"])
        self.assertEqual(semantic_result["error_code"], "REALTIME_AI_DISABLED")
        self.assertEqual(response.data["ai"]["status"], "DISABLED")
        self.assertEqual(response.data["ai"]["fallback_count"], 1)
        self.assertEqual(
            response.data["hybrid_decisions"][0]["result"]["decision_source"],
            "RULE_ONLY_FALLBACK",
        )
        self.assertTrue(
            response.data["hybrid_decisions"][0]["result"]["fallback_applied"]
        )
        self.assertFalse(
            response.data["hybrid_decisions"][0]["result"][
                "should_start_warning_cycle"
            ]
        )
        self.assertEqual(BrowserEvent.objects.filter(session_id=session.id).count(), 1)
        self.assertFalse(AIAnalysisResult.objects.exists())

    @override_settings(
        REALTIME_SCORE_MIN_EVENTS=1,
        AI_SEMANTIC_REALTIME_ENABLED=True,
    )
    def test_deep_work_ai_success_core_loop_persists_hybrid_warning_and_realtime_score(self):
        session = self.create_session(mode=FocusSession.Mode.DEEP_WORK)
        BlacklistEntry.objects.create(
            user=self.user,
            domain="youtube.com",
            severity=BlacklistEntry.Severity.HIGH,
        )

        with patch.object(
            AIClient,
            "complete_json",
            return_value={
                "content": (
                    '{"relevance_score": 15, "classification": "NOT_RELEVANT", '
                    '"confidence": 0.94, "reason": "Not aligned."}'
                ),
                "source": "openrouter",
                "model": "test-model",
                "latency_ms": 12,
            },
        ) as complete_json:
            with patch.object(WarningCycleService, "schedule_advance"):
                ingest = self.client.post(
                    f"/api/sessions/{session.id}/events/batch/",
                    {
                        "events": [
                            self.valid_event(
                                url="https://www.youtube.com/watch?v=abc",
                                domain="www.youtube.com",
                                page_title="Unrelated video",
                                content_snippet="Entertainment video unrelated to work.",
                            )
                        ]
                    },
                    format="json",
                )

        realtime = self.client.get(f"/api/sessions/{session.id}/score/realtime/")
        warnings = self.client.get(f"/api/sessions/{session.id}/warnings/")

        analysis = AIAnalysisResult.objects.get()
        hybrid_result = ingest.data["hybrid_decisions"][0]["result"]
        self.assertEqual(ingest.status_code, status.HTTP_200_OK)
        complete_json.assert_called_once()
        self.assertEqual(analysis.session_id, session.id)
        self.assertEqual(analysis.relevance_score, 15)
        self.assertEqual(analysis.focus_state, AIAnalysisResult.FocusState.DISTRACTED)
        self.assertEqual(hybrid_result["decision_source"], "HYBRID")
        self.assertEqual(hybrid_result["state"], "DISTRACTED")
        self.assertTrue(hybrid_result["should_start_warning_cycle"])
        self.assertEqual(WarningCycle.objects.filter(session_id=session.id).count(), 1)
        self.assertEqual(WarningEvent.objects.filter(session_id=session.id).count(), 1)
        self.assertEqual(realtime.status_code, status.HTTP_200_OK)
        self.assertEqual(realtime.data["components"]["content_relevance"], 15)
        self.assertEqual(realtime.data["ai_status"], "OK")
        self.assertEqual(warnings.status_code, status.HTTP_200_OK)
        self.assertEqual(warnings.data["warning_count"], 1)

    def test_unexpected_ai_error_does_not_make_event_ingest_return_500(self):
        session = self.create_session(mode=FocusSession.Mode.DEEP_WORK)

        with patch.object(
            AIClient,
            "complete_json",
            side_effect=RuntimeError("Authorization: Bearer secret-api-key"),
        ) as complete_json:
            response = self.client.post(
                f"/api/sessions/{session.id}/events/batch/",
                {"events": [self.valid_event()]},
                format="json",
            )

        semantic_result = response.data["semantic_evaluations"][0]["result"]
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complete_json.assert_not_called()
        self.assertEqual(response.data["accepted_count"], 1)
        self.assertEqual(semantic_result["status"], "skipped")
        self.assertFalse(semantic_result["available"])
        self.assertEqual(semantic_result["error_code"], "REALTIME_AI_DISABLED")
        self.assertEqual(response.data["ai"]["status"], "DISABLED")
        self.assertEqual(BrowserEvent.objects.filter(session_id=session.id).count(), 1)
        self.assertFalse(AIAnalysisResult.objects.exists())


class BehaviorRuleEngineTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="rules@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="rules-other@example.com",
            password=PASSWORD,
        )
        self.engine = BehaviorRuleEngine()

    def event(self, **overrides):
        values = {
            "event_type": "url_change",
            "url": "https://docs.djangoproject.com/",
            "domain": "docs.djangoproject.com",
            "idle_seconds": 0,
            "tab_switch_count": 0,
        }
        values.update(overrides)
        return values

    def add_blacklist(self, user, domain, severity):
        return BlacklistEntry.objects.create(
            user=user,
            domain=domain,
            severity=severity,
        )

    def test_safe_domain_low_idle_low_tab_switch_is_low_without_warning(self):
        result = self.engine.evaluate_event(self.user, self.event())

        self.assertEqual(result["risk_level"], "LOW")
        self.assertEqual(result["risk_score"], 0)
        self.assertFalse(result["should_warn"])
        self.assertEqual(result["reason_codes"], [])
        self.assertEqual(
            [signal["rule"] for signal in result["signals"]],
            ["blacklist", "idle", "tab_switch"],
        )

    def test_medium_blacklist_returns_medium_and_should_warn(self):
        self.add_blacklist(
            self.user,
            "reddit.com",
            BlacklistEntry.Severity.MEDIUM,
        )

        result = self.engine.evaluate_event(
            self.user,
            self.event(domain="reddit.com"),
        )

        self.assertEqual(result["risk_level"], "MEDIUM")
        self.assertEqual(result["risk_score"], 60)
        self.assertTrue(result["should_warn"])
        self.assertEqual(result["reason_codes"], ["BLACKLIST_MEDIUM"])

    def test_high_blacklist_returns_high_and_should_warn(self):
        self.add_blacklist(
            self.user,
            "youtube.com",
            BlacklistEntry.Severity.HIGH,
        )

        result = self.engine.evaluate_event(
            self.user,
            self.event(domain="youtube.com"),
        )

        self.assertEqual(result["risk_level"], "HIGH")
        self.assertEqual(result["risk_score"], 90)
        self.assertTrue(result["should_warn"])
        self.assertEqual(result["reason_codes"], ["BLACKLIST_HIGH"])

    def test_blacklist_from_user_a_does_not_affect_user_b(self):
        self.add_blacklist(
            self.user,
            "example.com",
            BlacklistEntry.Severity.HIGH,
        )

        result = self.engine.evaluate_event(
            self.other_user,
            self.event(domain="example.com"),
        )

        self.assertEqual(result["risk_level"], "LOW")
        self.assertFalse(result["should_warn"])
        self.assertIsNone(result["blacklist_match"])

    def test_idle_threshold_boundaries(self):
        cases = [
            (59, "LOW", []),
            (60, "MEDIUM", ["IDLE_MEDIUM"]),
            (179, "MEDIUM", ["IDLE_MEDIUM"]),
            (180, "HIGH", ["IDLE_HIGH"]),
        ]

        for idle_seconds, risk_level, reason_codes in cases:
            with self.subTest(idle_seconds=idle_seconds):
                result = self.engine.evaluate_event(
                    self.user,
                    self.event(idle_seconds=idle_seconds),
                )

                self.assertEqual(result["risk_level"], risk_level)
                self.assertEqual(result["reason_codes"], reason_codes)

    def test_tab_switch_threshold_boundaries(self):
        cases = [
            (4, "LOW", []),
            (5, "MEDIUM", ["TAB_SWITCH_MEDIUM"]),
            (9, "MEDIUM", ["TAB_SWITCH_MEDIUM"]),
            (10, "HIGH", ["TAB_SWITCH_HIGH"]),
        ]

        for tab_switch_count, risk_level, reason_codes in cases:
            with self.subTest(tab_switch_count=tab_switch_count):
                result = self.engine.evaluate_event(
                    self.user,
                    self.event(tab_switch_count=tab_switch_count),
                )

                self.assertEqual(result["risk_level"], risk_level)
                self.assertEqual(result["reason_codes"], reason_codes)

    def test_multiple_triggered_signals_are_preserved_with_highest_overall_risk(self):
        self.add_blacklist(
            self.user,
            "reddit.com",
            BlacklistEntry.Severity.MEDIUM,
        )

        result = self.engine.evaluate_event(
            self.user,
            self.event(domain="reddit.com", idle_seconds=180, tab_switch_count=10),
        )

        self.assertEqual(result["risk_level"], "HIGH")
        self.assertEqual(result["risk_score"], 80)
        self.assertEqual(
            result["reason_codes"],
            ["BLACKLIST_MEDIUM", "IDLE_HIGH", "TAB_SWITCH_HIGH"],
        )
        self.assertEqual(len(result["signals"]), 3)

    def test_none_negative_and_missing_fields_are_handled_safely(self):
        none_result = self.engine.evaluate_event(self.user, None)
        missing_result = self.engine.evaluate_event(self.user, {})
        negative_result = self.engine.evaluate_event(
            self.user,
            self.event(domain=None, idle_seconds=-1, tab_switch_count=-3),
        )

        for result in [none_result, missing_result, negative_result]:
            with self.subTest(result=result):
                self.assertEqual(result["risk_level"], "LOW")
                self.assertEqual(result["risk_score"], 0)
                self.assertFalse(result["should_warn"])

    def test_domain_normalization_handles_protocol_www_path_and_query(self):
        self.assertEqual(
            normalize_rule_domain("https://www.Example.com/path?utm=1"),
            "example.com",
        )
        self.assertEqual(
            normalize_rule_domain("http://www.example.com:443/path"),
            "example.com",
        )

    def test_valid_subdomain_matches_root_blacklist_domain(self):
        self.add_blacklist(
            self.user,
            "youtube.com",
            BlacklistEntry.Severity.HIGH,
        )

        result = self.engine.evaluate_event(
            self.user,
            self.event(domain="m.youtube.com"),
        )

        self.assertEqual(result["risk_level"], "HIGH")
        self.assertEqual(result["blacklist_match"]["domain"], "youtube.com")

    def test_similar_domain_without_boundary_does_not_match(self):
        self.add_blacklist(
            self.user,
            "youtube.com",
            BlacklistEntry.Severity.HIGH,
        )

        result = self.engine.evaluate_event(
            self.user,
            self.event(domain="notyoutube.com"),
        )

        self.assertEqual(result["risk_level"], "LOW")
        self.assertIsNone(result["blacklist_match"])

    def test_rule_engine_does_not_call_ai_client(self):
        with patch.object(AIClient, "analyze_relevance") as analyze_relevance:
            result = self.engine.evaluate_event(self.user, self.event())

        self.assertEqual(result["risk_level"], "LOW")
        analyze_relevance.assert_not_called()


class WarningCycleServiceTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="warnings@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="warnings-other@example.com",
            password=PASSWORD,
        )
        self.service = WarningCycleService(interval_seconds=5, max_level=3)

    def create_session(self, user=None, **overrides):
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.DEEP_WORK,
            "goal": "Study Django",
            "status": FocusSession.Status.ACTIVE,
            "target_duration_seconds": 3000,
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def create_event(self, session, **overrides):
        values = {
            "session_id": session.id,
            "event_type": "url_change",
            "domain": "youtube.com",
        }
        values.update(overrides)
        return BrowserEvent.objects.create(**values)

    def decision(
        self,
        state="DISTRACTED",
        score=86,
        reason_codes=None,
        decision_source="HYBRID",
    ):
        return {
            "state": state,
            "decision_score": score,
            "decision_source": decision_source,
            "reason_codes": reason_codes or ["CONTENT_NOT_RELEVANT", "BLACKLIST_HIGH"],
        }

    def start_cycle(self, session=None, event=None):
        session = session or self.create_session()
        event = event or self.create_event(session)
        with patch.object(WarningCycleService, "schedule_advance"):
            result = self.service.handle_decision(
                session=session,
                decision=self.decision(),
                source_event=event,
                domain=event.domain,
            )
        return session, event, WarningCycle.objects.get(pk=result["cycle_id"])

    def test_focused_and_potentially_distracted_do_not_create_warning(self):
        session = self.create_session()
        event = self.create_event(session)

        for state in ["FOCUSED", "POTENTIALLY_DISTRACTED"]:
            with self.subTest(state=state):
                self.service.handle_decision(
                    session=session,
                    decision=self.decision(state=state),
                    source_event=event,
                )

        self.assertFalse(WarningCycle.objects.exists())
        self.assertFalse(WarningEvent.objects.exists())

    def test_distracted_creates_warning_1_and_schedules_task(self):
        session = self.create_session()
        event = self.create_event(session)

        with patch.object(WarningCycleService, "schedule_advance"):
            result = self.service.handle_decision(
                session=session,
                decision=self.decision(),
                source_event=event,
                domain=event.domain,
            )

        cycle = WarningCycle.objects.get(pk=result["cycle_id"])
        warning = WarningEvent.objects.get(warning_cycle=cycle)
        self.assertEqual(cycle.status, WarningCycle.Status.WARNING_1_SENT)
        self.assertEqual(warning.warning_level, 1)
        self.assertEqual(warning.browser_event_id, event.id)
        self.assertEqual(warning.session_id, session.id)
        self.assertEqual(warning.reason_codes, ["CONTENT_NOT_RELEVANT", "BLACKLIST_HIGH"])
        self.assertEqual(warning.decision_source, "HYBRID")
        self.assertFalse(warning.auto_pause_required)
        self.assertIsNotNone(cycle.next_warning_at)

    def test_before_interval_does_not_create_warning_2(self):
        _session, _event, cycle = self.start_cycle()

        result = self.service.advance_cycle(
            cycle.id,
            now=cycle.next_warning_at - timedelta(seconds=1),
        )

        self.assertEqual(result["current_level"], 1)
        self.assertEqual(WarningEvent.objects.filter(warning_cycle=cycle).count(), 1)

    def test_interval_advances_to_warning_2_then_warning_3(self):
        _session, _event, cycle = self.start_cycle()

        with patch.object(WarningCycleService, "schedule_advance"):
            first = self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)
        cycle.refresh_from_db()
        second = self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)

        self.assertEqual(first["current_level"], 2)
        self.assertEqual(second["current_level"], 3)
        self.assertEqual(
            WarningEvent.objects.filter(warning_cycle=cycle).count(),
            3,
        )
        self.assertFalse(
            WarningEvent.objects.filter(
                warning_cycle=cycle,
                warning_level=4,
            ).exists()
        )

    def test_deep_work_warning_3_sets_auto_pause_signal_without_pausing(self):
        session, _event, cycle = self.start_cycle()

        with patch.object(WarningCycleService, "schedule_advance"):
            self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)
        cycle.refresh_from_db()
        result = self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)
        session.refresh_from_db()

        self.assertEqual(result["status"], WarningCycle.Status.AUTO_PAUSE_REQUIRED)
        self.assertTrue(result["auto_pause_required"])
        self.assertEqual(result["action"], WarningCycle.Action.AUTO_PAUSE)
        self.assertEqual(session.status, FocusSession.Status.ACTIVE)
        self.assertFalse(
            WarningEvent.objects.filter(triggered_auto_pause=True).exists()
        )

    def test_normal_mode_warning_3_completes_without_auto_pause(self):
        session = self.create_session(mode=FocusSession.Mode.NORMAL, goal="")
        event = self.create_event(session)
        _session, _event, cycle = self.start_cycle(session=session, event=event)

        with patch.object(WarningCycleService, "schedule_advance"):
            self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)
        cycle.refresh_from_db()
        result = self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)
        session.refresh_from_db()

        self.assertEqual(result["status"], WarningCycle.Status.COMPLETED)
        self.assertFalse(result["auto_pause_required"])
        self.assertEqual(result["action"], WarningCycle.Action.NONE)
        self.assertEqual(session.status, FocusSession.Status.ACTIVE)

    def test_recovery_after_warning_1_or_2_resolves_cycle_and_task_noops(self):
        session, event, cycle = self.start_cycle()
        resolved = self.service.handle_decision(
            session=session,
            decision=self.decision(state="FOCUSED"),
            source_event=event,
        )
        task_result = self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)

        self.assertEqual(resolved["status"], WarningCycle.Status.RESOLVED)
        self.assertIsNone(task_result)

        session, event, cycle = self.start_cycle(
            session=session,
            event=self.create_event(session, domain="reddit.com"),
        )
        with patch.object(WarningCycleService, "schedule_advance"):
            self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)
        resolved = self.service.handle_decision(
            session=session,
            decision=self.decision(state="POTENTIALLY_DISTRACTED"),
            source_event=event,
        )
        cycle.refresh_from_db()
        task_result = self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)

        self.assertEqual(resolved["status"], WarningCycle.Status.RESOLVED)
        self.assertIsNone(task_result)

    def test_paused_finished_and_cancelled_sessions_do_not_advance(self):
        for session_status in [
            FocusSession.Status.PAUSED,
            FocusSession.Status.COMPLETED,
            FocusSession.Status.CANCELLED,
        ]:
            with self.subTest(session_status=session_status):
                user = User.objects.create_user(
                    email=f"warnings-{session_status}@example.com",
                    password=PASSWORD,
                )
                session = self.create_session(user=user)
                event = self.create_event(session)
                session, _event, cycle = self.start_cycle(session=session, event=event)
                FocusSession.objects.filter(pk=session.pk).update(status=session_status)

                self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)

                self.assertEqual(
                    WarningEvent.objects.filter(warning_cycle=cycle).count(),
                    1,
                )

    def test_retry_and_duplicate_tasks_do_not_create_duplicate_warnings(self):
        session = self.create_session()
        event = self.create_event(session)

        with patch.object(WarningCycleService, "schedule_advance"):
            self.service.handle_decision(session, self.decision(), event, event.domain)
            self.service.handle_decision(session, self.decision(), event, event.domain)
        cycle = WarningCycle.objects.get()
        with patch.object(WarningCycleService, "schedule_advance"):
            self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)
            self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)
        cycle.refresh_from_db()
        self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)
        self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)

        self.assertEqual(WarningCycle.objects.count(), 1)
        self.assertEqual(
            WarningEvent.objects.filter(warning_cycle=cycle, warning_level=1).count(),
            1,
        )
        self.assertEqual(
            WarningEvent.objects.filter(warning_cycle=cycle, warning_level=2).count(),
            1,
        )
        self.assertEqual(
            WarningEvent.objects.filter(warning_cycle=cycle, warning_level=3).count(),
            1,
        )
        self.assertLessEqual(WarningEvent.objects.filter(warning_cycle=cycle).count(), 3)

    def test_only_one_active_cycle_and_new_cycle_after_recovery(self):
        session, event, first_cycle = self.start_cycle()
        second_event = self.create_event(session, domain="reddit.com")

        with patch.object(WarningCycleService, "schedule_advance"):
            same_cycle = self.service.handle_decision(
                session,
                self.decision(score=90),
                second_event,
                second_event.domain,
            )

        self.assertEqual(same_cycle["cycle_id"], str(first_cycle.id))
        self.assertEqual(WarningCycle.objects.active().filter(session_id=session.id).count(), 1)

        self.service.handle_decision(session, self.decision("FOCUSED"), event)
        with patch.object(WarningCycleService, "schedule_advance"):
            new_cycle = self.service.handle_decision(
                session,
                self.decision(score=91),
                second_event,
                second_event.domain,
            )

        self.assertNotEqual(new_cycle["cycle_id"], str(first_cycle.id))

    def test_old_cycle_task_does_not_advance_new_cycle(self):
        session, event, old_cycle = self.start_cycle()
        self.service.handle_decision(session, self.decision("FOCUSED"), event)
        new_event = self.create_event(session, domain="reddit.com")
        _session, _event, new_cycle = self.start_cycle(session=session, event=new_event)

        self.service.advance_cycle(old_cycle.id, now=old_cycle.next_warning_at)

        self.assertEqual(WarningEvent.objects.filter(warning_cycle=old_cycle).count(), 1)
        self.assertEqual(WarningEvent.objects.filter(warning_cycle=new_cycle).count(), 1)

    def test_other_user_event_does_not_affect_session(self):
        session = self.create_session()
        other_session = self.create_session(user=self.other_user)
        other_event = self.create_event(other_session)

        result = self.service.handle_decision(
            session,
            self.decision(),
            source_event=other_event,
            domain=other_event.domain,
        )

        self.assertIsNone(result)
        self.assertFalse(WarningEvent.objects.exists())

    def test_warning_does_not_store_snippet_or_call_ai_or_sleep(self):
        session = self.create_session()
        event = self.create_event(session)

        with patch.object(AIClient, "complete_json") as complete_json:
            with patch("time.sleep") as sleep:
                with patch.object(WarningCycleService, "schedule_advance"):
                    self.service.handle_decision(
                        session,
                        self.decision(),
                        source_event=event,
                        domain=event.domain,
                    )

        warning = WarningEvent.objects.get()
        self.assertEqual(warning.message, "Warning 1: distraction detected.")
        self.assertFalse(hasattr(warning, "content_snippet"))
        complete_json.assert_not_called()
        sleep.assert_not_called()


class SessionWarningsApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="warning-api@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="warning-api-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)
        self.service = WarningCycleService(interval_seconds=5, max_level=3)

    def create_session(self, user=None, **overrides):
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.DEEP_WORK,
            "goal": "Study Django",
            "status": FocusSession.Status.ACTIVE,
            "target_duration_seconds": 3000,
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def create_event(self, session):
        return BrowserEvent.objects.create(
            session_id=session.id,
            event_type="url_change",
            domain="youtube.com",
        )

    def create_cycle(self, session):
        event = self.create_event(session)
        with patch.object(WarningCycleService, "schedule_advance"):
            result = self.service.handle_decision(
                session,
                {
                    "state": "DISTRACTED",
                    "decision_score": 86,
                    "reason_codes": ["CONTENT_NOT_RELEVANT", "BLACKLIST_HIGH"],
                },
                source_event=event,
                domain=event.domain,
            )
        return WarningCycle.objects.get(pk=result["cycle_id"])

    def test_anonymous_request_is_denied(self):
        session = self.create_session()
        self.client.force_authenticate(user=None)

        response = self.client.get(f"/api/sessions/{session.id}/warnings/")

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_empty_warning_log_returns_200(self):
        session = self.create_session()

        response = self.client.get(f"/api/sessions/{session.id}/warnings/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["session_id"], str(session.id))
        self.assertEqual(response.data["warning_count"], 0)
        self.assertIsNone(response.data["active_cycle"])
        self.assertEqual(response.data["warnings"], [])

    def test_owner_gets_warning_log_sorted_with_active_cycle(self):
        session = self.create_session()
        cycle = self.create_cycle(session)
        with patch.object(WarningCycleService, "schedule_advance"):
            self.service.advance_cycle(cycle.id, now=cycle.next_warning_at)

        response = self.client.get(f"/api/sessions/{session.id}/warnings/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["warning_count"], 2)
        self.assertEqual(response.data["active_cycle"]["cycle_id"], str(cycle.id))
        self.assertFalse(response.data["active_cycle"]["auto_pause_required"])
        self.assertEqual([item["level"] for item in response.data["warnings"]], [1, 2])
        self.assertIn("cycle_id", response.data["warnings"][0])
        self.assertIn("decision_state", response.data["warnings"][0])
        self.assertIn("decision_score", response.data["warnings"][0])
        self.assertIn("reason_codes", response.data["warnings"][0])
        self.assertNotIn("content_snippet", response.data["warnings"][0])
        self.assertNotIn("raw_response", response.data["warnings"][0])

    def test_cross_user_and_missing_session_return_404(self):
        session = self.create_session()

        self.client.force_authenticate(self.other_user)
        other_response = self.client.get(f"/api/sessions/{session.id}/warnings/")
        missing_response = self.client.get(
            "/api/sessions/00000000-0000-0000-0000-000000000000/warnings/"
        )

        self.assertEqual(other_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(missing_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_does_not_create_warning_or_change_session(self):
        session = self.create_session()

        response = self.client.get(f"/api/sessions/{session.id}/warnings/")
        session.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(WarningEvent.objects.count(), 0)
        self.assertEqual(session.status, FocusSession.Status.ACTIVE)

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.sessions.models import FocusSession

from .models import ExtensionHeartbeat


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


class ExtensionApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="extension@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="extension-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def create_session(self, user=None, **overrides):
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.NORMAL,
            "status": FocusSession.Status.ACTIVE,
            "target_duration_seconds": 3000,
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def test_heartbeat_creates_and_updates_current_user_record(self):
        create = self.client.post(
            "/api/extension/heartbeat/",
            {
                "extension_version": "1.0.0",
                "browser": "chrome",
            },
            format="json",
        )
        heartbeat = ExtensionHeartbeat.objects.get(user_id=self.user.id)
        original_last_seen = heartbeat.last_seen
        ExtensionHeartbeat.objects.filter(pk=heartbeat.pk).update(
            is_active=False,
            last_seen=timezone.now() - timedelta(minutes=5),
        )

        update = self.client.post(
            "/api/extension/heartbeat/",
            {
                "extension_version": "1.1.0",
                "browser": "edge",
            },
            format="json",
        )

        self.assertEqual(create.status_code, status.HTTP_200_OK)
        self.assertEqual(create.data["status"], "ok")
        self.assertTrue(create.data["connected"])
        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertEqual(ExtensionHeartbeat.objects.filter(user_id=self.user.id).count(), 1)

        heartbeat.refresh_from_db()
        self.assertEqual(heartbeat.extension_version, "1.1.0")
        self.assertEqual(heartbeat.browser, "edge")
        self.assertTrue(heartbeat.is_active)
        self.assertGreater(heartbeat.last_seen, original_last_seen)

    def test_heartbeat_validates_input(self):
        response = self.client.post(
            "/api/extension/heartbeat/",
            {"browser": "chrome"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("extension_version", response.data)

    def test_active_session_returns_current_users_active_session(self):
        active_session = self.create_session(goal="Finish extension sync")

        response = self.client.get("/api/extension/active-session/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_active_session"])
        self.assertEqual(response.data["session"]["id"], str(active_session.id))
        self.assertEqual(response.data["session"]["goal"], "Finish extension sync")
        self.assertEqual(response.data["session"]["status"], FocusSession.Status.ACTIVE)

    def test_active_session_ignores_other_users_and_non_active_sessions(self):
        self.create_session(
            status=FocusSession.Status.PAUSED,
        )
        self.create_session(user=self.other_user)

        response = self.client.get("/api/extension/active-session/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["has_active_session"])
        self.assertIsNone(response.data["session"])

    def test_extension_sync_endpoints_require_authentication(self):
        self.client.force_authenticate(user=None)

        heartbeat = self.client.post(
            "/api/extension/heartbeat/",
            {
                "extension_version": "1.0.0",
                "browser": "chrome",
            },
            format="json",
        )
        active_session = self.client.get("/api/extension/active-session/")

        self.assertIn(
            heartbeat.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )
        self.assertIn(
            active_session.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )


class BlacklistApiTests(APITestCase):
    def test_blacklist_is_empty_until_extension_storage_is_implemented(self):
        user = User.objects.create_user(email="blacklist@example.com", password=PASSWORD)
        self.client.force_authenticate(user)

        response = self.client.get("/api/blacklist/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])


from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.sessions.models import FocusSession

from .models import BlacklistEntry, ExtensionHeartbeat


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

    def test_heartbeat_accepts_extension_session_token_without_cookie_auth(self):
        session = self.create_session()
        token = session.ensure_extension_bridge_token()
        self.client.force_authenticate(user=None)

        response = self.client.post(
            "/api/extension/heartbeat/",
            {
                "extension_version": "1.2.0",
                "browser": "chrome",
            },
            format="json",
            HTTP_X_FOCUSOS_SESSION_ID=str(session.id),
            HTTP_X_FOCUSOS_EXTENSION_TOKEN=token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["connected"])
        heartbeat = ExtensionHeartbeat.objects.get(user_id=self.user.id)
        self.assertEqual(heartbeat.extension_version, "1.2.0")

    def test_heartbeat_extension_token_bypasses_session_csrf(self):
        session = self.create_session()
        token = session.ensure_extension_bridge_token()
        csrf_client = APIClient(enforce_csrf_checks=True)
        self.assertTrue(csrf_client.login(email=self.user.email, password=PASSWORD))

        response = csrf_client.post(
            "/api/extension/heartbeat/",
            {
                "extension_version": "1.3.0",
                "browser": "chrome",
            },
            format="json",
            HTTP_ORIGIN="chrome-extension://hjjldlnbhofmlndoabaophfnmdmeigne",
            HTTP_X_FOCUSOS_SESSION_ID=str(session.id),
            HTTP_X_FOCUSOS_EXTENSION_TOKEN=token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["connected"])


class BlacklistApiTests(APITestCase):
    def setUp(self):
        user = User.objects.create_user(email="blacklist@example.com", password=PASSWORD)
        self.client.force_authenticate(user)
        self.user = user

    def test_default_blacklist_is_seeded_and_synced(self):
        response = self.client.get("/api/blacklist/")
        sync = self.client.get("/api/blacklist/sync/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 8)
        self.assertTrue(all(entry["isDefault"] for entry in response.data))
        self.assertEqual(sync.status_code, status.HTTP_200_OK)
        self.assertEqual(sync.data["version"], "blacklist-v1")
        self.assertEqual(len(sync.data["entries"]), len(response.data))

    def test_custom_blacklist_crud_and_sync_payload(self):
        create = self.client.post(
            "/api/blacklist/",
            {"domain": "https://www.example.com/path", "severity": "medium"},
            format="json",
        )
        entry_id = create.data["id"]
        update = self.client.patch(
            f"/api/blacklist/{entry_id}/",
            {"severity": "high"},
            format="json",
        )
        sync = self.client.get("/api/blacklist/sync/")
        delete = self.client.delete(f"/api/blacklist/{entry_id}/")

        self.assertEqual(create.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create.data["domain"], "example.com")
        self.assertFalse(create.data["isDefault"])
        self.assertEqual(update.data["severity"], "high")
        self.assertIn(
            {"domain": "example.com", "severity": "high", "source": "USER", "enabled": True},
            [
                {
                    "domain": entry["domain"],
                    "severity": entry["severity"],
                    "source": entry["source"],
                    "enabled": entry["enabled"],
                }
                for entry in sync.data["entries"]
            ],
        )
        self.assertEqual(delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(BlacklistEntry.objects.filter(pk=entry_id).exists())

    def test_default_entries_can_be_changed_or_removed_per_user(self):
        self.client.get("/api/blacklist/")
        default = BlacklistEntry.objects.filter(is_default=True).first()

        update = self.client.patch(
            f"/api/blacklist/{default.pk}/",
            {"severity": "medium"},
            format="json",
        )
        delete = self.client.delete(f"/api/blacklist/{default.pk}/")
        list_after_delete = self.client.get("/api/blacklist/")

        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertEqual(update.data["severity"], "medium")
        self.assertEqual(delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertNotIn(default.domain, [entry["domain"] for entry in list_after_delete.data])

    def test_anonymous_user_is_denied(self):
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/blacklist/")

        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_cross_user_custom_entries_are_hidden(self):
        create = self.client.post(
            "/api/blacklist/",
            {"domain": "example.com", "severity": "medium"},
            format="json",
        )
        entry_id = create.data["id"]
        other_user = User.objects.create_user(
            email="blacklist-other@example.com",
            password=PASSWORD,
        )

        self.client.force_authenticate(other_user)
        retrieve = self.client.get(f"/api/blacklist/{entry_id}/")
        update = self.client.patch(
            f"/api/blacklist/{entry_id}/",
            {"severity": "high"},
            format="json",
        )
        delete = self.client.delete(f"/api/blacklist/{entry_id}/")
        sync = self.client.get("/api/blacklist/sync/")

        self.assertEqual(retrieve.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(update.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete.status_code, status.HTTP_404_NOT_FOUND)
        self.assertNotIn(
            "example.com",
            [entry["domain"] for entry in sync.data["entries"]],
        )

    def test_duplicate_normalized_domain_is_rejected(self):
        first = self.client.post(
            "/api/blacklist/",
            {"domain": "https://www.Example.com/path", "severity": "medium"},
            format="json",
        )
        duplicate = self.client.post(
            "/api/blacklist/",
            {"domain": "example.com", "severity": "high"},
            format="json",
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(first.data["domain"], "example.com")
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            BlacklistEntry.objects.filter(user=self.user, domain="example.com").count(),
            1,
        )

    def test_invalid_domains_are_rejected(self):
        invalid_domains = [
            "",
            "localhost",
            "-example.com",
            "example..com",
            "example.com:443",
            "bad_domain.com",
        ]

        for domain in invalid_domains:
            with self.subTest(domain=domain):
                response = self.client.post(
                    "/api/blacklist/",
                    {"domain": domain, "severity": "medium"},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

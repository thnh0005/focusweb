from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import BlacklistEntry


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


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

    def test_custom_blacklist_crud_and_default_protection(self):
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
            {"domain": "example.com", "severity": "high", "source": "custom"},
            [
                {
                    "domain": entry["domain"],
                    "severity": entry["severity"],
                    "source": entry["source"],
                }
                for entry in sync.data["entries"]
            ],
        )
        self.assertEqual(delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(BlacklistEntry.objects.filter(pk=entry_id).exists())

    def test_default_entries_cannot_be_changed_or_deleted(self):
        self.client.get("/api/blacklist/")
        default = BlacklistEntry.objects.filter(is_default=True).first()

        update = self.client.patch(
            f"/api/blacklist/{default.pk}/",
            {"severity": "medium"},
            format="json",
        )
        delete = self.client.delete(f"/api/blacklist/{default.pk}/")

        self.assertEqual(update.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(delete.status_code, status.HTTP_403_FORBIDDEN)


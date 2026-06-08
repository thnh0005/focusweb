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


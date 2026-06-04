from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


class BlacklistApiTests(APITestCase):
    def test_blacklist_is_empty_until_extension_storage_is_implemented(self):
        user = User.objects.create_user(email="blacklist@example.com", password=PASSWORD)
        self.client.force_authenticate(user)

        response = self.client.get("/api/blacklist/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])


from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import OnboardingSurvey, Profile, UserPreference


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


def get_csrf_token(client):
    response = client.get("/api/auth/csrf/")
    assert response.status_code == status.HTTP_200_OK
    assert "csrftoken" in response.cookies
    return response.data["csrfToken"]


class AuthApiTests(APITestCase):
    def test_register_creates_related_records_and_session(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "NewUser@example.com",
                "password": PASSWORD,
                "passwordConfirm": PASSWORD,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["email"], "newuser@example.com")
        self.assertFalse(response.data["user"]["onboardingComplete"])
        self.assertIn("sessionid", response.cookies)
        self.assertIn("csrftoken", response.cookies)

        user = User.objects.get(email="newuser@example.com")
        self.assertTrue(Profile.objects.filter(user=user).exists())
        self.assertTrue(UserPreference.objects.filter(user=user).exists())
        self.assertTrue(OnboardingSurvey.objects.filter(user=user).exists())

        me_response = self.client.get("/api/auth/me/")
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["id"], str(user.id))

    def test_register_validates_duplicate_email_password_and_confirmation(self):
        User.objects.create_user(email="exists@example.com", password=PASSWORD)

        duplicate = self.client.post(
            "/api/auth/register/",
            {
                "email": "EXISTS@example.com",
                "password": PASSWORD,
                "passwordConfirm": PASSWORD,
            },
            format="json",
        )
        mismatch = self.client.post(
            "/api/auth/register/",
            {
                "email": "other@example.com",
                "password": PASSWORD,
                "passwordConfirm": "DifferentPass123!",
            },
            format="json",
        )
        weak = self.client.post(
            "/api/auth/register/",
            {
                "email": "weak@example.com",
                "password": "123",
                "passwordConfirm": "123",
            },
            format="json",
        )

        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", duplicate.data)
        self.assertEqual(mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("passwordConfirm", mismatch.data)
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", weak.data)

    def test_login_uses_generic_error_and_logout_clears_session(self):
        User.objects.create_user(email="member@example.com", password=PASSWORD)

        invalid = self.client.post(
            "/api/auth/login/",
            {"email": "member@example.com", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid credentials.", str(invalid.data))

        login = self.client.post(
            "/api/auth/login/",
            {"email": "member@example.com", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertIn("sessionid", login.cookies)

        logout = self.client.post("/api/auth/logout/", format="json")
        self.assertEqual(logout.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, status.HTTP_403_FORBIDDEN)

    def test_login_and_register_require_pre_auth_csrf(self):
        User.objects.create_user(email="csrf-login@example.com", password=PASSWORD)

        login_client = APIClient(enforce_csrf_checks=True)
        blocked_login = login_client.post(
            "/api/auth/login/",
            {"email": "csrf-login@example.com", "password": PASSWORD},
            format="json",
        )
        login_csrf_token = get_csrf_token(login_client)
        allowed_login = login_client.post(
            "/api/auth/login/",
            {"email": "csrf-login@example.com", "password": PASSWORD},
            format="json",
            HTTP_X_CSRFTOKEN=login_csrf_token,
        )

        register_client = APIClient(enforce_csrf_checks=True)
        blocked_register = register_client.post(
            "/api/auth/register/",
            {
                "email": "csrf-register@example.com",
                "password": PASSWORD,
                "passwordConfirm": PASSWORD,
            },
            format="json",
        )
        register_csrf_token = get_csrf_token(register_client)
        allowed_register = register_client.post(
            "/api/auth/register/",
            {
                "email": "csrf-register@example.com",
                "password": PASSWORD,
                "passwordConfirm": PASSWORD,
            },
            format="json",
            HTTP_X_CSRFTOKEN=register_csrf_token,
        )

        self.assertEqual(blocked_login.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(allowed_login.status_code, status.HTTP_200_OK)
        self.assertEqual(blocked_register.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(allowed_register.status_code, status.HTTP_201_CREATED)

    def test_authenticated_mutations_require_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        pre_auth_csrf_token = get_csrf_token(client)
        register = client.post(
            "/api/auth/register/",
            {
                "email": "csrf@example.com",
                "password": PASSWORD,
                "passwordConfirm": PASSWORD,
            },
            format="json",
            HTTP_X_CSRFTOKEN=pre_auth_csrf_token,
        )
        csrf_token = register.cookies["csrftoken"].value

        blocked = client.patch(
            "/api/users/profile/",
            {"displayName": "Blocked"},
            format="json",
        )
        allowed = client.patch(
            "/api/users/profile/",
            {"displayName": "Allowed"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(allowed.data["displayName"], "Allowed")


class UserApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="member@example.com", password=PASSWORD)
        self.client.force_authenticate(self.user)

    def test_profile_and_preferences_support_primary_and_alias_routes(self):
        profile = self.client.patch(
            "/api/users/profile/",
            {
                "displayName": "Focus Member",
                "profession": "developer",
                "learningDomain": ["Backend", "AI"],
            },
            format="json",
        )
        preferences = self.client.patch(
            "/api/user/preferences/",
            {
                "defaultMode": "deep-work",
                "defaultDurationMinutes": 90,
                "ambientEffect": "rain",
                "ambientSoundVolume": 80,
            },
            format="json",
        )

        self.assertEqual(profile.status_code, status.HTTP_200_OK)
        self.assertEqual(profile.data["displayName"], "Focus Member")
        self.assertEqual(profile.data["learningDomain"], ["Backend", "AI"])
        self.assertEqual(preferences.status_code, status.HTTP_200_OK)
        self.assertEqual(preferences.data["defaultMode"], "deep-work")
        self.assertEqual(preferences.data["defaultDurationMinutes"], 90)
        self.assertIn("goalTemplates", preferences.data)

        alias_profile = self.client.get("/api/user/profile/")
        primary_preferences = self.client.get("/api/users/preferences/")
        self.assertEqual(alias_profile.status_code, status.HTTP_200_OK)
        self.assertEqual(primary_preferences.status_code, status.HTTP_200_OK)

    def test_onboarding_complete_updates_profile_preferences_and_user(self):
        response = self.client.post(
            "/api/onboarding/complete/",
            {
                "profession": "student",
                "learningDomain": ["Computer Science"],
                "preferredDurationMinutes": 50,
                "extensionInstalled": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.user.profile.refresh_from_db()
        self.user.preferences.refresh_from_db()
        self.user.onboarding_survey.refresh_from_db()
        self.assertTrue(self.user.onboarding_complete)
        self.assertEqual(self.user.profile.profession, "student")
        self.assertEqual(self.user.profile.learning_domain, ["Computer Science"])
        self.assertEqual(self.user.preferences.default_duration_minutes, 50)
        self.assertTrue(self.user.preferences.extension_installed)
        self.assertIsNotNone(self.user.onboarding_survey.completed_at)

    def test_onboarding_can_be_skipped_via_frontend_alias(self):
        response = self.client.post(
            "/api/auth/onboarding/",
            {"skipped": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.user.onboarding_survey.refresh_from_db()
        self.assertTrue(self.user.onboarding_complete)
        self.assertTrue(self.user.onboarding_survey.skipped)


import json
import re
from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.sessions.models import FocusSession

from .models import AccountDataExportJob, AccountDeletionJob, OnboardingSurvey, Profile, UserPreference
from .services import MusicProviderDetector


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

    def test_password_reset_request_and_confirm_match_frontend_contract(self):
        user = User.objects.create_user(email="reset@example.com", password=PASSWORD)
        new_password = "C9!ResetPass$"

        request_reset = self.client.post(
            "/api/auth/password-reset/",
            {"email": "reset@example.com"},
            format="json",
        )
        missing_user = self.client.post(
            "/api/auth/password-reset/",
            {"email": "missing@example.com"},
            format="json",
        )

        self.assertEqual(request_reset.status_code, status.HTTP_200_OK)
        self.assertEqual(missing_user.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        token = re.search(r"token=(\S+)", mail.outbox[0].body).group(1)

        confirm = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "token": token,
                "new_password": new_password,
                "new_password_confirm": new_password,
            },
            format="json",
        )
        reuse = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "token": token,
                "new_password": "D9!AnotherPass$",
                "new_password_confirm": "D9!AnotherPass$",
            },
            format="json",
        )
        invalid_reuse = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "token": "invalid",
                "new_password": new_password,
                "new_password_confirm": new_password,
            },
            format="json",
        )

        self.assertEqual(confirm.status_code, status.HTTP_200_OK)
        self.assertEqual(reuse.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_reuse.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertTrue(user.check_password(new_password))


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

    def test_notification_settings_route_updates_preference_fields(self):
        update = self.client.patch(
            "/api/notifications/settings/",
            {
                "notificationsEnabled": True,
                "sessionReminderEnabled": True,
                "sessionReminderTime": "08:30",
                "weeklySummaryEnabled": False,
                "deepWorkSuggestionEnabled": True,
            },
            format="json",
        )
        read = self.client.get("/api/notifications/settings/")

        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertTrue(update.data["sessionReminderEnabled"])
        self.assertEqual(update.data["sessionReminderTime"], "08:30")
        self.assertFalse(update.data["weeklySummaryEnabled"])
        self.assertEqual(read.status_code, status.HTTP_200_OK)
        self.assertEqual(read.data["sessionReminderTime"], "08:30")

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

    def test_week_4_music_theme_and_ambient_preferences(self):
        music = self.client.put(
            "/api/music/preferences/",
            {
                "musicEnabled": False,
                "musicTrack": "lofi",
                "customPlaylistUrl": "https://example.com/focus-playlist",
                "soundEnabled": True,
                "ambientSoundVolume": 25,
            },
            format="json",
        )
        theme = self.client.put(
            "/api/theme/preferences/",
            {
                "theme": "aurora-night",
                "themeAccent": "violet",
                "workspaceBackgroundUrl": "https://example.com/background.png",
            },
            format="json",
        )
        ambient = self.client.put(
            "/api/ambient/preferences/",
            {
                "ambientEffect": "rain",
                "ambientEffectEnabled": True,
                "ambientEffectIntensity": 80,
            },
            format="json",
        )

        self.assertEqual(music.status_code, status.HTTP_200_OK)
        self.assertFalse(music.data["musicEnabled"])
        self.assertEqual(music.data["musicTrack"], "lofi")
        self.assertEqual(theme.status_code, status.HTTP_200_OK)
        self.assertEqual(theme.data["theme"], "aurora-night")
        self.assertEqual(theme.data["themeAccent"], "violet")
        self.assertEqual(ambient.status_code, status.HTTP_200_OK)
        self.assertEqual(ambient.data["ambientEffectIntensity"], 80)

    def test_week_4_streak_uses_completed_session_days(self):
        for days_ago in (0, 1, 3):
            started_at = timezone.now() - timedelta(days=days_ago)
            FocusSession.objects.create(
                user=self.user,
                mode=FocusSession.Mode.NORMAL,
                status=FocusSession.Status.COMPLETED,
                target_duration_seconds=3600,
                actual_duration_seconds=1800,
                focus_score=80,
                started_at=started_at,
                ended_at=started_at + timedelta(minutes=30),
            )

        response = self.client.get("/api/streak/")
        alias = self.client.get("/api/user/streak/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["currentStreak"], 2)
        self.assertEqual(response.data["longestStreak"], 2)
        self.assertEqual(response.data["milestones"][0]["days"], 3)
        self.assertEqual(alias.status_code, status.HTTP_200_OK)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.streak_count, 2)

    def test_week_4_change_password_export_and_delete_account(self):
        FocusSession.objects.create(
            user=self.user,
            mode=FocusSession.Mode.NORMAL,
            status=FocusSession.Status.COMPLETED,
            goal="Export account data",
            target_duration_seconds=1800,
            actual_duration_seconds=1200,
            focus_score=70,
            ended_at=timezone.now(),
        )
        new_password = "B8!newPassWord$"

        change = self.client.post(
            "/api/account/change-password/",
            {
                "currentPassword": PASSWORD,
                "newPassword": new_password,
                "newPasswordConfirm": new_password,
            },
            format="json",
        )
        with patch("apps.users.views.generate_account_data_export_task.delay") as export_delay:
            with self.captureOnCommitCallbacks(execute=True):
                export = self.client.post("/api/account/export-data/", format="json")

        self.assertEqual(change.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))
        self.assertEqual(export.status_code, status.HTTP_202_ACCEPTED)
        export_job = AccountDataExportJob.objects.get(user=self.user)
        self.assertEqual(str(export.data["jobId"]), str(export_job.id))
        self.assertEqual(export_job.status, AccountDataExportJob.Status.PENDING)
        export_delay.assert_called_once_with(str(export_job.id))
        export_status = self.client.get(f"/api/account/export-data/{export_job.id}/")
        self.assertEqual(export_status.status_code, status.HTTP_200_OK)
        self.assertEqual(export_status.data["jobId"], str(export_job.id))

        with patch("apps.users.views.delete_account_data_task.delay") as delete_delay:
            with self.captureOnCommitCallbacks(execute=True):
                delete = self.client.delete(
                    "/api/account/delete/",
                    {"currentPassword": new_password},
                    format="json",
                )
        self.assertEqual(delete.status_code, status.HTTP_202_ACCEPTED)
        deletion_job = AccountDeletionJob.objects.get(
            user_identifier_snapshot__gt="",
        )
        self.assertEqual(str(delete.data["jobId"]), str(deletion_job.id))
        self.assertTrue(deletion_job.confirmed)
        delete_delay.assert_called_once_with(str(deletion_job.id))
        self.client.force_authenticate(self.user)
        delete_status = self.client.get(f"/api/account/delete/{deletion_job.id}/")
        self.assertEqual(delete_status.status_code, status.HTTP_200_OK)
        self.assertEqual(delete_status.data["jobId"], str(deletion_job.id))

    def test_account_job_status_is_owner_scoped(self):
        other_user = User.objects.create_user(email="job-other@example.com", password=PASSWORD)
        export_job = AccountDataExportJob.objects.create(user=other_user)
        delete_job = AccountDeletionJob.objects.create(user=other_user)

        export_status = self.client.get(f"/api/account/export-data/{export_job.id}/")
        delete_status = self.client.get(f"/api/account/delete/{delete_job.id}/")

        self.assertEqual(export_status.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete_status.status_code, status.HTTP_404_NOT_FOUND)


class MusicPreferenceDay24Tests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="music@example.com", password=PASSWORD)
        self.other_user = User.objects.create_user(
            email="music-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def test_get_put_and_patch_require_authentication(self):
        self.client.force_authenticate(user=None)

        responses = [
            self.client.get("/api/music/preferences/"),
            self.client.put("/api/music/preferences/", {}, format="json"),
            self.client.patch("/api/music/preferences/", {}, format="json"),
        ]

        for response in responses:
            self.assertIn(
                response.status_code,
                [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
            )

    def test_get_returns_defaults_and_creates_no_duplicate_preference(self):
        self.user.preferences.delete()

        first = self.client.get("/api/music/preferences/")
        second = self.client.get("/api/music/preferences/")

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertFalse(first.data["enabled"])
        self.assertEqual(first.data["built_in_track"], "none")
        self.assertEqual(first.data["volume"], 50)
        self.assertFalse(first.data["autoplay"])
        self.assertFalse(first.data["custom_playlist"]["enabled"])
        self.assertIsNone(first.data["custom_playlist"]["url"])
        self.assertEqual(first.data["custom_playlist"]["provider"], "none")
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(UserPreference.objects.filter(user=self.user).count(), 1)

    def test_user_cannot_select_or_modify_other_user_preference(self):
        other_preferences = self.other_user.preferences
        other_preferences.music_enabled = False
        other_preferences.music_track = UserPreference.MusicTrack.NONE
        other_preferences.save()

        invalid = self.client.put(
            "/api/music/preferences/",
            {
                "user_id": str(self.other_user.id),
                "enabled": True,
                "built_in_track": "rain",
                "volume": 40,
            },
            format="json",
        )
        valid = self.client.put(
            "/api/music/preferences/",
            {
                "enabled": True,
                "built_in_track": "rain",
                "volume": 40,
                "autoplay": False,
                "use_custom_playlist": False,
            },
            format="json",
        )

        other_preferences.refresh_from_db()
        payload = json.dumps(valid.data, default=str)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(valid.status_code, status.HTTP_200_OK)
        self.assertTrue(valid.data["preferences"]["enabled"])
        self.assertFalse(other_preferences.music_enabled)
        self.assertNotIn(str(self.other_user.id), payload)

    def test_builtin_tracks_and_source_are_validated(self):
        for track in ["lofi", "rain", "forest", "cafe", "white_noise"]:
            response = self.client.put(
                "/api/music/preferences/",
                {
                    "enabled": True,
                    "built_in_track": track,
                    "volume": 45,
                    "autoplay": False,
                    "use_custom_playlist": False,
                },
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["preferences"]["built_in_track"], track)
            self.assertEqual(response.data["preferences"]["source"], "built_in")

        disabled_none = self.client.put(
            "/api/music/preferences/",
            {
                "enabled": False,
                "built_in_track": "none",
                "volume": 50,
                "autoplay": False,
                "use_custom_playlist": False,
            },
            format="json",
        )
        enabled_none = self.client.put(
            "/api/music/preferences/",
            {
                "enabled": True,
                "built_in_track": "none",
                "volume": 50,
                "use_custom_playlist": False,
            },
            format="json",
        )
        invalid_track = self.client.put(
            "/api/music/preferences/",
            {"enabled": True, "built_in_track": "ocean", "volume": 50},
            format="json",
        )

        self.assertEqual(disabled_none.status_code, status.HTTP_200_OK)
        self.assertEqual(enabled_none.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_track.status_code, status.HTTP_400_BAD_REQUEST)

    def test_legacy_camel_case_contract_is_still_supported(self):
        response = self.client.put(
            "/api/music/preferences/",
            {
                "musicEnabled": False,
                "musicTrack": "lofi",
                "customPlaylistUrl": "https://example.com/focus-playlist",
                "soundEnabled": True,
                "ambientSoundVolume": 25,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["musicEnabled"])
        self.assertEqual(response.data["musicTrack"], "lofi")
        self.assertEqual(response.data["ambientSoundVolume"], 25)
        self.assertEqual(response.data["custom_playlist_provider"], "external")

    def test_volume_accepts_only_integer_zero_to_one_hundred(self):
        for value in [0, 35, 100]:
            response = self.client.patch(
                "/api/music/preferences/",
                {"volume": value},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data["preferences"]["volume"], value)

        for value in [-1, 101, "40", 12.5]:
            response = self.client.patch(
                "/api/music/preferences/",
                {"volume": value},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_custom_playlist_detects_provider_and_does_not_call_network_or_ai(self):
        with patch("urllib.request.urlopen") as urlopen, patch(
            "socket.getaddrinfo",
        ) as getaddrinfo, patch(
            "apps.ai.services.ai_client.AIClient.complete_json",
        ) as complete_json:
            spotify = self.client.put(
                "/api/music/preferences/",
                {
                    "enabled": True,
                    "volume": 35,
                    "autoplay": False,
                    "use_custom_playlist": True,
                    "custom_playlist_url": " https://open.spotify.com/playlist/abc#frag ",
                    "custom_playlist_provider": "spotify",
                },
                format="json",
            )

        self.assertEqual(spotify.status_code, status.HTTP_200_OK)
        self.assertEqual(spotify.data["preferences"]["source"], "custom_playlist")
        self.assertEqual(
            spotify.data["preferences"]["custom_playlist_provider"],
            "spotify",
        )
        self.assertEqual(
            spotify.data["preferences"]["custom_playlist_url"],
            "https://open.spotify.com/playlist/abc",
        )
        urlopen.assert_not_called()
        getaddrinfo.assert_not_called()
        complete_json.assert_not_called()

    def test_provider_detector_supports_youtube_direct_audio_and_external(self):
        cases = {
            "https://music.youtube.com/playlist?list=abc": "youtube_music",
            "https://cdn.example.com/focus.mp3": "direct_audio",
            "https://example.com/playlist": "external",
        }

        for url, provider in cases.items():
            self.assertEqual(MusicProviderDetector.detect_provider(url), provider)

    def test_custom_playlist_rules_and_atomic_invalid_update(self):
        valid = self.client.put(
            "/api/music/preferences/",
            {
                "enabled": True,
                "volume": 40,
                "use_custom_playlist": True,
                "custom_playlist_url": "https://open.spotify.com/playlist/good",
                "custom_playlist_provider": "spotify",
            },
            format="json",
        )
        missing_url = self.client.patch(
            "/api/music/preferences/",
            {"use_custom_playlist": True, "custom_playlist_url": ""},
            format="json",
        )
        mismatch = self.client.patch(
            "/api/music/preferences/",
            {
                "use_custom_playlist": True,
                "custom_playlist_url": "https://open.spotify.com/playlist/good",
                "custom_playlist_provider": "youtube_music",
            },
            format="json",
        )
        explicit_none = self.client.patch(
            "/api/music/preferences/",
            {
                "use_custom_playlist": True,
                "custom_playlist_url": "https://open.spotify.com/playlist/good",
                "custom_playlist_provider": "none",
            },
            format="json",
        )

        self.user.preferences.refresh_from_db()
        self.assertEqual(valid.status_code, status.HTTP_200_OK)
        self.assertEqual(missing_url.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(explicit_none.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.user.preferences.custom_playlist_url,
            "https://open.spotify.com/playlist/good",
        )

    def test_switching_back_to_builtin_keeps_existing_custom_url(self):
        self.client.put(
            "/api/music/preferences/",
            {
                "enabled": True,
                "volume": 40,
                "use_custom_playlist": True,
                "custom_playlist_url": "https://open.spotify.com/playlist/keep",
            },
            format="json",
        )

        response = self.client.patch(
            "/api/music/preferences/",
            {
                "enabled": True,
                "built_in_track": "rain",
                "use_custom_playlist": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["preferences"]["source"], "built_in")
        self.assertEqual(
            response.data["preferences"]["custom_playlist_url"],
            "https://open.spotify.com/playlist/keep",
        )

    def test_url_security_rejects_unsafe_urls_without_partial_save(self):
        original = self.user.preferences
        original.custom_playlist_url = "https://example.com/original"
        original.custom_playlist_provider = "external"
        original.save()
        invalid_urls = [
            "javascript:alert(1)",
            "data:text/plain,hello",
            "file:///tmp/song.mp3",
            "ftp://example.com/song.mp3",
            "blob:https://example.com/id",
            "chrome-extension://abc/song.mp3",
            "http://example.com/song.mp3",
            "https://user:pass@example.com/song.mp3",
            "https://localhost/song.mp3",
            "https://127.0.0.1/song.mp3",
            "https://[::1]/song.mp3",
            "https://169.254.169.254/latest/meta-data",
            "https://10.0.0.5/song.mp3",
            "https://",
            f"https://example.com/{'a' * 2050}",
        ]

        for url in invalid_urls:
            response = self.client.patch(
                "/api/music/preferences/",
                {
                    "use_custom_playlist": True,
                    "custom_playlist_url": url,
                },
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, url)

        self.user.preferences.refresh_from_db()
        self.assertEqual(
            self.user.preferences.custom_playlist_url,
            "https://example.com/original",
        )


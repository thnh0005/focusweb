from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.ai.services.ai_client import AIClient
from apps.extension.models import BlacklistEntry
from apps.sessions.models import FocusSession
from apps.tracking.models import BrowserEvent, WarningEvent
from apps.users.models import UserPreference

from .smart_preset_service import SmartPresetService
from .tasks import generate_weekly_focus_report_task
from .weekly_report_service import WeeklyFocusReportService


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


class PatternDetectionApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="patterns@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="patterns-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)
        self.now = timezone.now()

    def create_session(self, user=None, **overrides):
        started_at = overrides.pop("started_at", self.now - timedelta(days=1))
        actual_duration_seconds = overrides.pop("actual_duration_seconds", 55 * 60)
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.NORMAL,
            "status": FocusSession.Status.COMPLETED,
            "target_duration_seconds": 60 * 60,
            "actual_duration_seconds": actual_duration_seconds,
            "focus_score": 80,
            "focus_state": "focused",
            "started_at": started_at,
            "ended_at": started_at + timedelta(seconds=actual_duration_seconds),
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def create_warning(self, session, domain="youtube.com", offset_minutes=10):
        event = BrowserEvent.objects.create(
            session_id=session.id,
            event_type="url_change",
            url=f"https://{domain}/private/watch?id=abc",
            domain=domain,
            page_title="Private page title",
            content_snippet="Private snippet",
            tab_switch_count=2,
            idle_seconds=30,
        )
        warning = WarningEvent.objects.create(
            session_id=session.id,
            browser_event=event,
            warning_level=1,
            warning_type=WarningEvent.WarningType.DEEP_WORK_AI,
            domain=domain,
            url=f"https://{domain}/private/watch?id=abc",
            message="Warning text",
        )
        timestamp = session.started_at + timedelta(minutes=offset_minutes)
        BrowserEvent.objects.filter(pk=event.pk).update(created_at=timestamp)
        WarningEvent.objects.filter(pk=warning.pk).update(created_at=timestamp)
        warning.refresh_from_db()
        return warning

    def test_authentication_required(self):
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/patterns/")

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_under_five_sessions_returns_insufficient_data(self):
        for index in range(4):
            self.create_session(focus_score=70 + index)

        response = self.client.get("/api/patterns/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "insufficient_data")
        self.assertEqual(response.data["minimum_sessions"], 5)
        self.assertEqual(response.data["current_sessions"], 4)
        self.assertIsNone(response.data["patterns"])

    def test_exactly_five_sessions_returns_patterns_and_does_not_call_ai(self):
        for index in range(5):
            self.create_session(focus_score=75 + index)

        with patch.object(AIClient, "complete_json") as complete_json:
            response = self.client.get("/api/patterns/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ready")
        self.assertEqual(response.data["session_count"], 5)
        self.assertIn("best_time", response.data["patterns"])
        complete_json.assert_not_called()

    def test_cancelled_and_other_user_sessions_are_not_counted(self):
        for index in range(4):
            self.create_session(focus_score=80 + index)
        self.create_session(
            status=FocusSession.Status.CANCELLED,
            focus_score=100,
        )
        self.create_session(user=self.other_user, focus_score=100)

        response = self.client.get("/api/patterns/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "insufficient_data")
        self.assertEqual(response.data["current_sessions"], 4)

    def test_completed_session_without_score_is_not_counted(self):
        for index in range(4):
            self.create_session(focus_score=80 + index)
        self.create_session(focus_score=None, focus_state="")

        response = self.client.get("/api/patterns/")

        self.assertEqual(response.data["status"], "insufficient_data")
        self.assertEqual(response.data["current_sessions"], 4)

    def test_best_time_uses_start_hour_bucket_and_reliability(self):
        yesterday = self.now - timedelta(days=1)
        for index in range(4):
            self.create_session(
                started_at=yesterday.replace(hour=19, minute=0, second=0, microsecond=0)
                - timedelta(days=index),
                focus_score=84,
            )
        self.create_session(
            started_at=yesterday.replace(hour=9, minute=0, second=0, microsecond=0),
            focus_score=100,
        )

        response = self.client.get("/api/patterns/?range=30d")
        best_time = response.data["patterns"]["best_time"]

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(best_time["label"], "18:00-23:59")
        self.assertEqual(best_time["start_hour"], 18)
        self.assertEqual(best_time["session_count"], 4)
        self.assertEqual(best_time["average_score"], 84.0)

    def test_best_duration_uses_duration_bucket_and_reliability(self):
        for index in range(4):
            self.create_session(
                started_at=self.now - timedelta(days=index),
                actual_duration_seconds=55 * 60,
                focus_score=82,
            )
        self.create_session(actual_duration_seconds=95 * 60, focus_score=100)

        response = self.client.get("/api/patterns/?range=30d")
        best_duration = response.data["patterns"]["best_duration"]

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(best_duration["label"], "50-69")
        self.assertEqual(best_duration["min_minutes"], 50)
        self.assertEqual(best_duration["max_minutes"], 69)
        self.assertEqual(best_duration["session_count"], 4)

    def test_top_domain_is_aggregated_without_private_fields(self):
        sessions = [self.create_session(started_at=self.now - timedelta(days=i)) for i in range(5)]
        self.create_warning(sessions[0], "youtube.com", offset_minutes=10)
        self.create_warning(sessions[1], "youtube.com", offset_minutes=20)
        self.create_warning(sessions[2], "reddit.com", offset_minutes=40)

        response = self.client.get("/api/patterns/?range=30d")
        distractions = response.data["patterns"]["distraction_triggers"]
        response_text = str(response.data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(distractions["top_domains"][0]["domain"], "youtube.com")
        self.assertEqual(distractions["top_domains"][0]["warning_count"], 2)
        self.assertEqual(distractions["top_domains"][0]["affected_session_count"], 2)
        self.assertEqual(distractions["most_distracted_period"], "early")
        self.assertNotIn("https://", response_text)
        self.assertNotIn("Private page title", response_text)
        self.assertNotIn("Private snippet", response_text)

    def test_no_warnings_returns_valid_empty_distraction_response(self):
        for index in range(5):
            self.create_session(started_at=self.now - timedelta(days=index))

        response = self.client.get("/api/patterns/")
        distractions = response.data["patterns"]["distraction_triggers"]

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(distractions["top_domains"], [])
        self.assertEqual(distractions["average_warnings_per_session"], 0)
        self.assertIsNone(distractions["most_distracted_period"])

    def test_range_filter_defaults_to_30d_and_supports_90d_and_all(self):
        for index in range(4):
            self.create_session(started_at=self.now - timedelta(days=index))
        self.create_session(started_at=self.now - timedelta(days=60))

        default_response = self.client.get("/api/patterns/")
        ninety_days = self.client.get("/api/patterns/?range=90d")
        all_time = self.client.get("/api/patterns/?range=all")

        self.assertEqual(default_response.data["status"], "insufficient_data")
        self.assertEqual(default_response.data["current_sessions"], 4)
        self.assertEqual(ninety_days.status_code, status.HTTP_200_OK)
        self.assertEqual(ninety_days.data["status"], "ready")
        self.assertEqual(ninety_days.data["session_count"], 5)
        self.assertEqual(all_time.data["status"], "ready")

    def test_invalid_range_returns_400(self):
        response = self.client.get("/api/patterns/?range=7d")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class RecommendationAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="recommendations@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="recommendations-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)
        self.now = timezone.now()

    def create_session(self, user=None, **overrides):
        started_at = overrides.pop("started_at", self.now - timedelta(days=1))
        actual_duration_seconds = overrides.pop("actual_duration_seconds", 55 * 60)
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.NORMAL,
            "status": FocusSession.Status.COMPLETED,
            "target_duration_seconds": 60 * 60,
            "actual_duration_seconds": actual_duration_seconds,
            "focus_score": 82,
            "focus_state": "focused",
            "started_at": started_at,
            "ended_at": started_at + timedelta(seconds=actual_duration_seconds),
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def create_baseline_sessions(self, count=5, **overrides):
        return [
            self.create_session(started_at=self.now - timedelta(days=index + 1), **overrides)
            for index in range(count)
        ]

    def create_warning(self, session, domain="example.com", offset_minutes=10, **event_overrides):
        event_values = {
            "session_id": session.id,
            "event_type": "url_change",
            "url": f"https://{domain}/private/path?q=secret",
            "domain": domain,
            "page_title": "Private title",
            "meta_description": "Private meta",
            "content_snippet": "Private snippet",
            "tab_switch_count": 0,
            "idle_seconds": 0,
        }
        event_values.update(event_overrides)
        event = BrowserEvent.objects.create(**event_values)
        warning = WarningEvent.objects.create(
            session_id=session.id,
            browser_event=event,
            warning_level=1,
            warning_type=WarningEvent.WarningType.DEEP_WORK_AI,
            domain=domain,
            url=event.url,
            message="Warning text",
        )
        timestamp = session.started_at + timedelta(minutes=offset_minutes)
        BrowserEvent.objects.filter(pk=event.pk).update(created_at=timestamp)
        WarningEvent.objects.filter(pk=warning.pk).update(created_at=timestamp)
        return warning

    def recommendations(self, response):
        return {item["type"]: item for item in response.data["recommendations"]}

    def recommendation_by_reason(self, response, reason_code):
        return next(
            item
            for item in response.data["recommendations"]
            if item["reason_code"] == reason_code
        )

    def test_authentication_required(self):
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/recommendations/")

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_under_five_sessions_returns_insufficient_data(self):
        self.create_baseline_sessions(count=4)

        response = self.client.get("/api/recommendations/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "insufficient_data")
        self.assertEqual(response.data["minimum_sessions"], 5)
        self.assertEqual(response.data["current_sessions"], 4)
        self.assertEqual(response.data["recommendations"], [])
        self.assertIsNone(response.data["smart_preset"])

    def test_exactly_five_sessions_creates_recommendations(self):
        self.create_baseline_sessions(count=5)

        response = self.client.get("/api/recommendations/?limit=10")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ready")
        self.assertEqual(response.data["session_count"], 5)
        self.assertGreater(len(response.data["recommendations"]), 0)
        self.assertIsNotNone(response.data["smart_preset"])

    def test_cancelled_session_is_not_used(self):
        self.create_baseline_sessions(count=4)
        self.create_session(
            status=FocusSession.Status.CANCELLED,
            focus_score=100,
        )

        response = self.client.get("/api/recommendations/")

        self.assertEqual(response.data["status"], "insufficient_data")
        self.assertEqual(response.data["current_sessions"], 4)

    def test_other_user_session_is_not_used(self):
        self.create_baseline_sessions(count=4)
        self.create_session(user=self.other_user, focus_score=100)

        response = self.client.get("/api/recommendations/")

        self.assertEqual(response.data["status"], "insufficient_data")
        self.assertEqual(response.data["current_sessions"], 4)

    def test_duration_recommendation_maps_bucket_to_frontend_value(self):
        for index in range(4):
            self.create_session(
                started_at=self.now - timedelta(days=index + 1),
                actual_duration_seconds=55 * 60,
                focus_score=84,
            )
        self.create_session(actual_duration_seconds=95 * 60, focus_score=100)

        response = self.client.get("/api/recommendations/?limit=10")
        duration = self.recommendations(response)["duration"]

        self.assertEqual(duration["reason_code"], "best_duration_bucket")
        self.assertEqual(duration["recommended_value"], 50)
        self.assertEqual(duration["unit"], "minutes")

    def test_deep_work_recommendation_when_it_outperforms_normal(self):
        for index in range(3):
            self.create_session(
                mode=FocusSession.Mode.DEEP_WORK,
                focus_score=92,
                started_at=self.now - timedelta(days=index + 1),
            )
        for index in range(2):
            self.create_session(
                mode=FocusSession.Mode.NORMAL,
                focus_score=74,
                started_at=self.now - timedelta(days=index + 4),
            )

        response = self.client.get("/api/recommendations/?limit=10")
        mode = self.recommendations(response)["mode"]

        self.assertEqual(mode["reason_code"], "deep_work_outperforms_normal")
        self.assertEqual(mode["recommended_value"], "deep_work")
        self.assertEqual(mode["priority"], "high")

    def test_normal_mode_recommendation_when_it_outperforms_deep_work(self):
        for index in range(3):
            self.create_session(
                mode=FocusSession.Mode.NORMAL,
                focus_score=91,
                started_at=self.now - timedelta(days=index + 1),
            )
        for index in range(2):
            self.create_session(
                mode=FocusSession.Mode.DEEP_WORK,
                focus_score=76,
                started_at=self.now - timedelta(days=index + 4),
            )

        response = self.client.get("/api/recommendations/?limit=10")
        mode = self.recommendations(response)["mode"]

        self.assertEqual(mode["reason_code"], "normal_outperforms_deep_work")
        self.assertEqual(mode["recommended_value"], "normal")

    def test_small_mode_difference_returns_no_clear_preference(self):
        for index in range(3):
            self.create_session(
                mode=FocusSession.Mode.NORMAL,
                focus_score=80,
                started_at=self.now - timedelta(days=index + 1),
            )
        for index in range(2):
            self.create_session(
                mode=FocusSession.Mode.DEEP_WORK,
                focus_score=83,
                started_at=self.now - timedelta(days=index + 4),
            )

        response = self.client.get("/api/recommendations/?limit=10")
        mode = self.recommendations(response)["mode"]

        self.assertEqual(mode["reason_code"], "no_clear_mode_preference")
        self.assertIsNone(mode["recommended_value"])

    def test_break_recommendation_uses_duration_rule(self):
        self.create_baseline_sessions(count=5, actual_duration_seconds=55 * 60)

        response = self.client.get("/api/recommendations/?limit=10")
        break_recommendation = self.recommendations(response)["break"]

        self.assertEqual(break_recommendation["recommended_value"], 10)
        self.assertEqual(break_recommendation["unit"], "minutes")

    def test_preferred_time_recommendation_uses_best_time(self):
        yesterday = self.now - timedelta(days=1)
        for index in range(4):
            self.create_session(
                started_at=yesterday.replace(hour=19, minute=0, second=0, microsecond=0)
                - timedelta(days=index),
                focus_score=84,
            )
        self.create_session(
            started_at=yesterday.replace(hour=9, minute=0, second=0, microsecond=0),
            focus_score=100,
        )

        response = self.client.get("/api/recommendations/?limit=10")
        preferred_time = self.recommendations(response)["preferred_time"]

        self.assertEqual(preferred_time["reason_code"], "best_focus_time")
        self.assertEqual(preferred_time["recommended_value"]["label"], "18:00-23:59")
        self.assertEqual(preferred_time["recommended_value"]["start_hour"], 18)

    def test_top_domain_creates_distraction_recommendation(self):
        sessions = self.create_baseline_sessions(count=5)
        self.create_warning(sessions[0], domain="example.com")
        self.create_warning(sessions[1], domain="example.com")

        response = self.client.get("/api/recommendations/?limit=10")
        distraction = self.recommendations(response)["distraction"]

        self.assertEqual(distraction["reason_code"], "high_warning_domain")
        self.assertEqual(distraction["recommended_action"], "add_to_blacklist")
        self.assertEqual(distraction["domain"], "example.com")

    def test_blacklisted_domain_does_not_create_duplicate_add_action(self):
        BlacklistEntry.objects.create(user=self.user, domain="example.com")
        sessions = self.create_baseline_sessions(count=5)
        self.create_warning(sessions[0], domain="example.com")
        self.create_warning(sessions[1], domain="example.com")

        response = self.client.get("/api/recommendations/?limit=10")
        actions = [
            item.get("recommended_action")
            for item in response.data["recommendations"]
        ]

        self.assertNotIn("add_to_blacklist", actions)
        self.assertEqual(BlacklistEntry.objects.filter(user=self.user).count(), 1)

    def test_response_does_not_expose_full_url(self):
        sessions = self.create_baseline_sessions(count=5)
        self.create_warning(sessions[0], domain="example.com")
        self.create_warning(sessions[1], domain="example.com")

        response = self.client.get("/api/recommendations/?limit=10")

        self.assertNotIn("https://", str(response.data))
        self.assertNotIn("private/path", str(response.data))

    def test_response_does_not_expose_title_meta_or_snippet(self):
        sessions = self.create_baseline_sessions(count=5)
        self.create_warning(sessions[0], domain="example.com")
        self.create_warning(sessions[1], domain="example.com")

        response = self.client.get("/api/recommendations/?limit=10")
        response_text = str(response.data)

        self.assertNotIn("Private title", response_text)
        self.assertNotIn("Private meta", response_text)
        self.assertNotIn("Private snippet", response_text)

    def test_dataset_without_warning_still_works(self):
        self.create_baseline_sessions(count=5)

        response = self.client.get("/api/recommendations/?limit=10")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ready")
        self.assertNotIn("distraction", self.recommendations(response))

    def test_invalid_range_returns_400(self):
        response = self.client.get("/api/recommendations/?range=7d")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_limit_returns_400(self):
        non_integer = self.client.get("/api/recommendations/?limit=bad")
        too_low = self.client.get("/api/recommendations/?limit=0")
        too_high = self.client.get("/api/recommendations/?limit=11")

        self.assertEqual(non_integer.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(too_low.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(too_high.status_code, status.HTTP_400_BAD_REQUEST)

    def test_limit_is_applied(self):
        sessions = self.create_baseline_sessions(count=5)
        self.create_warning(sessions[0], domain="example.com")
        self.create_warning(sessions[1], domain="example.com")

        response = self.client.get("/api/recommendations/?limit=2")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["recommendations"]), 2)

    def test_recommendations_are_sorted_by_priority(self):
        sessions = self.create_baseline_sessions(count=5, focus_score=88)
        self.create_warning(sessions[0], domain="example.com")
        self.create_warning(sessions[1], domain="example.com")

        response = self.client.get("/api/recommendations/?limit=10")
        priorities = [item["priority"] for item in response.data["recommendations"]]
        order = {"high": 0, "medium": 1, "low": 2}

        self.assertEqual(priorities, sorted(priorities, key=lambda value: order[value]))

    def test_smart_preset_has_valid_mode_duration_and_break(self):
        self.create_baseline_sessions(count=5, actual_duration_seconds=55 * 60)

        response = self.client.get("/api/recommendations/?limit=10")
        preset = response.data["smart_preset"]

        self.assertIn(preset["mode"], ["normal", "deep_work"])
        self.assertEqual(preset["duration_minutes"], 50)
        self.assertEqual(preset["break_minutes"], 10)
        self.assertTrue(preset["personalized"])

    def test_recommendations_do_not_call_external_ai(self):
        self.create_baseline_sessions(count=5)

        with patch.object(AIClient, "complete_json") as complete_json:
            response = self.client.get("/api/recommendations/?limit=10")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complete_json.assert_not_called()


class SmartPresetDay22Tests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="smart@example.com", password=PASSWORD)
        self.other_user = User.objects.create_user(email="smart-other@example.com", password=PASSWORD)
        self.client.force_authenticate(self.user)
        self.now = timezone.now()

    def create_session(self, user=None, **overrides):
        started_at = overrides.pop("started_at", self.now - timedelta(days=1))
        actual_duration_seconds = overrides.pop("actual_duration_seconds", 55 * 60)
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.NORMAL,
            "status": FocusSession.Status.COMPLETED,
            "target_duration_seconds": 60 * 60,
            "actual_duration_seconds": actual_duration_seconds,
            "focus_score": 82,
            "focus_state": "focused",
            "started_at": started_at,
            "ended_at": started_at + timedelta(seconds=actual_duration_seconds),
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def create_baseline_sessions(self, count=5, **overrides):
        return [
            self.create_session(started_at=self.now - timedelta(days=index + 1), **overrides)
            for index in range(count)
        ]

    def test_endpoint_requires_authentication(self):
        self.client.force_authenticate(None)

        response = self.client.get("/api/smart-preset/")

        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_insufficient_data_uses_preference_fallback_and_is_not_personalized(self):
        UserPreference.objects.update_or_create(
            user=self.user,
            defaults={
                "default_mode": UserPreference.SessionMode.DEEP_WORK,
                "default_duration_minutes": 40,
            },
        )
        self.create_baseline_sessions(count=3)
        self.create_session(user=self.other_user, focus_score=100)

        response = self.client.get("/api/smart-preset/?user_id=ignored")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "insufficient_data")
        self.assertFalse(response.data["personalized"])
        self.assertEqual(response.data["current_sessions"], 3)
        self.assertEqual(response.data["preset"]["mode"], "deep_work")
        self.assertTrue(response.data["preset"]["requires_goal"])
        self.assertEqual(response.data["preset"]["duration_minutes"], 40)
        self.assertEqual(response.data["preset"]["break_minutes"], 10)
        self.assertEqual(response.data["preset"]["confidence"], "default")
        self.assertIn("insufficient_history", response.data["preset"]["reason_codes"])
        self.assertIn("user_preference_fallback", response.data["preset"]["reason_codes"])

    def test_no_preference_falls_back_to_system_default(self):
        UserPreference.objects.filter(user=self.user).delete()

        response = self.client.get("/api/smart-preset/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["preset"]["mode"], "normal")
        self.assertFalse(response.data["preset"]["requires_goal"])
        self.assertEqual(response.data["preset"]["duration_minutes"], 25)
        self.assertEqual(response.data["preset"]["break_minutes"], 5)
        self.assertIn("system_default_fallback", response.data["preset"]["reason_codes"])

    def test_exactly_five_sessions_returns_personalized_ready_preset(self):
        self.create_baseline_sessions(count=5, actual_duration_seconds=55 * 60)

        response = self.client.get("/api/smart-preset/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ready")
        self.assertTrue(response.data["personalized"])
        self.assertEqual(response.data["session_count"], 5)
        self.assertEqual(response.data["preset"]["duration_minutes"], 50)
        self.assertEqual(response.data["preset"]["break_minutes"], 10)
        self.assertIn(response.data["preset"]["confidence"], ["low", "medium", "high"])
        self.assertEqual(response.data["preset_version"], "v1")

    def test_cancelled_scoreless_and_other_user_sessions_are_ignored(self):
        self.create_baseline_sessions(count=4)
        self.create_session(status=FocusSession.Status.CANCELLED, focus_score=100)
        self.create_session(focus_score=None, focus_state="")
        self.create_session(user=self.other_user, focus_score=100)

        response = self.client.get("/api/smart-preset/")

        self.assertEqual(response.data["status"], "insufficient_data")
        self.assertEqual(response.data["current_sessions"], 4)

    def test_deep_work_mode_and_requires_goal_when_it_outperforms_normal(self):
        for index in range(3):
            self.create_session(
                mode=FocusSession.Mode.DEEP_WORK,
                focus_score=94,
                started_at=self.now - timedelta(days=index + 1),
            )
        for index in range(2):
            self.create_session(
                mode=FocusSession.Mode.NORMAL,
                focus_score=74,
                started_at=self.now - timedelta(days=index + 4),
            )

        response = self.client.get("/api/smart-preset/?range=30d")

        self.assertEqual(response.data["preset"]["mode"], "deep_work")
        self.assertTrue(response.data["preset"]["requires_goal"])
        self.assertIn("deep_work_outperforms_normal", response.data["preset"]["reason_codes"])

    def test_duration_bucket_break_and_preferred_time_are_selected(self):
        evening = self.now - timedelta(days=1)
        for index in range(5):
            self.create_session(
                started_at=evening.replace(hour=19, minute=0, second=0, microsecond=0)
                - timedelta(days=index),
                actual_duration_seconds=75 * 60,
                focus_score=86,
            )

        response = self.client.get("/api/smart-preset/?range=30d")
        preset = response.data["preset"]

        self.assertEqual(preset["duration_minutes"], 75)
        self.assertEqual(preset["break_minutes"], 15)
        self.assertEqual(preset["preferred_time"]["label"], "18:00-23:59")
        self.assertEqual(preset["preferred_time"]["start_hour"], 18)
        self.assertIn("best_duration_bucket", preset["reason_codes"])
        self.assertIn("best_focus_time", preset["reason_codes"])

    def test_invalid_preference_values_do_not_crash_and_fallback_safely(self):
        preference = self.user.preferences
        UserPreference.objects.filter(pk=preference.pk).update(
            default_mode="invalid",
            default_duration_minutes=0,
        )

        response = self.client.get("/api/smart-preset/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["preset"]["mode"], "normal")
        self.assertEqual(response.data["preset"]["duration_minutes"], 25)

    def test_invalid_range_returns_400(self):
        response = self.client.get("/api/smart-preset/?range=7d")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_response_does_not_expose_private_browser_fields_or_call_ai(self):
        sessions = self.create_baseline_sessions(count=5)
        BrowserEvent.objects.create(
            session_id=sessions[0].id,
            event_type="url_change",
            url="https://example.com/private/path",
            domain="example.com",
            page_title="Private title",
            meta_description="Private meta",
            content_snippet="Private snippet",
        )

        with patch.object(AIClient, "complete_json") as complete_json:
            response = self.client.get("/api/smart-preset/")

        response_text = str(response.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("https://", response_text)
        self.assertNotIn("Private title", response_text)
        self.assertNotIn("Private meta", response_text)
        self.assertNotIn("Private snippet", response_text)
        complete_json.assert_not_called()

    def test_pattern_and_recommendation_services_are_called_once(self):
        pattern_data = {
            "status": "ready",
            "session_count": 5,
            "period": {"range": "30d", "start": self.now - timedelta(days=30), "end": self.now},
            "patterns": {
                "best_time": {
                    "label": "18:00-23:59",
                    "start_hour": 18,
                    "end_hour": 23,
                    "session_count": 5,
                },
                "best_duration": {
                    "label": "50-69",
                    "session_count": 5,
                },
                "distraction_triggers": {
                    "top_domains": [],
                    "average_tab_switches": 0,
                    "average_warnings_per_session": 0,
                    "average_idle_seconds": 0,
                    "most_distracted_period": None,
                },
                "score_trend": {"direction": "stable", "change": 0},
            },
        }
        recommendation_data = {
            "status": "ready",
            "recommendations": [
                {
                    "type": "duration",
                    "confidence": "high",
                    "reason_code": "best_duration_bucket",
                    "recommended_value": 50,
                },
                {
                    "type": "break",
                    "confidence": "medium",
                    "reason_code": "recommended_break_after_session",
                    "recommended_value": 10,
                },
            ],
        }

        with patch("apps.recommendations.smart_preset_service.PatternDetectionService") as pattern_cls:
            with patch("apps.recommendations.smart_preset_service.FocusRecommendationService") as recommendation_cls:
                pattern_cls.return_value.build.return_value = pattern_data
                recommendation_cls.return_value.build.return_value = recommendation_data
                response = self.client.get("/api/smart-preset/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pattern_cls.assert_called_once()
        pattern_cls.return_value.build.assert_called_once()
        recommendation_cls.assert_called_once()
        recommendation_cls.return_value.build.assert_called_once()


class WeeklyFocusReportServiceTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="weekly-report@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="weekly-report-other@example.com",
            password=PASSWORD,
        )
        self.reference_date = date(2026, 6, 13)

    def aware(self, year, month, day, hour=9):
        return timezone.make_aware(
            timezone.datetime(year, month, day, hour, 0, 0),
            timezone.get_current_timezone(),
        )

    def create_session(self, user=None, **overrides):
        started_at = overrides.pop("started_at", self.aware(2026, 6, 9))
        actual_duration_seconds = overrides.pop("actual_duration_seconds", 30 * 60)
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.NORMAL,
            "status": FocusSession.Status.COMPLETED,
            "target_duration_seconds": 45 * 60,
            "actual_duration_seconds": actual_duration_seconds,
            "focus_score": 80,
            "focus_state": "focused",
            "started_at": started_at,
            "ended_at": started_at + timedelta(seconds=actual_duration_seconds),
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def create_warning(self, session, domain="youtube.com"):
        event = BrowserEvent.objects.create(
            session_id=session.id,
            event_type="url_change",
            url=f"https://{domain}/private/path",
            domain=domain,
            page_title="Private title",
            meta_description="Private meta",
            content_snippet="Private snippet",
            tab_switch_count=3,
            idle_seconds=15,
        )
        warning = WarningEvent.objects.create(
            session_id=session.id,
            browser_event=event,
            warning_level=1,
            warning_type=WarningEvent.WarningType.DEEP_WORK_AI,
            domain=domain,
            url=event.url,
        )
        timestamp = session.started_at + timedelta(minutes=5)
        BrowserEvent.objects.filter(pk=event.pk).update(created_at=timestamp)
        WarningEvent.objects.filter(pk=warning.pk).update(created_at=timestamp)
        return warning

    def build(self):
        return WeeklyFocusReportService(
            self.user,
            reference_date=self.reference_date,
        ).build()

    def seed_current_and_previous(self):
        current_normal = self.create_session(
            started_at=self.aware(2026, 6, 9),
            actual_duration_seconds=60 * 60,
            focus_score=90,
            mode=FocusSession.Mode.NORMAL,
        )
        current_deep = self.create_session(
            started_at=self.aware(2026, 6, 10),
            actual_duration_seconds=30 * 60,
            focus_score=80,
            mode=FocusSession.Mode.DEEP_WORK,
        )
        self.create_session(
            started_at=self.aware(2026, 6, 11),
            status="finished",
            actual_duration_seconds=0,
            focus_score=None,
            focus_state="",
        )
        self.create_session(
            started_at=self.aware(2026, 6, 12),
            status=FocusSession.Status.CANCELLED,
            actual_duration_seconds=90 * 60,
            focus_score=100,
        )
        self.create_session(
            user=self.other_user,
            started_at=self.aware(2026, 6, 10),
            actual_duration_seconds=999 * 60,
            focus_score=1,
        )
        self.create_session(
            started_at=self.aware(2026, 5, 20),
            actual_duration_seconds=777 * 60,
            focus_score=1,
        )
        previous = self.create_session(
            started_at=self.aware(2026, 6, 2),
            actual_duration_seconds=60 * 60,
            focus_score=75,
            mode=FocusSession.Mode.DEEP_WORK,
        )
        self.create_session(
            started_at=self.aware(2026, 6, 3),
            status="finished",
            actual_duration_seconds=0,
            focus_score=None,
            focus_state="",
        )
        self.create_warning(current_normal)
        self.create_warning(current_deep, domain="reddit.com")
        self.create_warning(previous)
        self.create_warning(previous)
        return current_normal, current_deep, previous

    def test_weekly_report_uses_user_scope_and_ignores_cancelled_and_outside_dates(self):
        self.seed_current_and_previous()

        report = self.build()

        self.assertEqual(report["current_week"]["total_sessions"], 3)
        self.assertEqual(report["current_week"]["completed_sessions"], 2)
        self.assertEqual(report["current_week"]["total_focus_minutes"], 90)
        self.assertEqual(report["current_week"]["average_focus_score"], 85.0)
        self.assertEqual(report["current_week"]["completion_rate"], 66.67)

    def test_current_and_previous_week_ranges_start_on_monday(self):
        self.seed_current_and_previous()

        report = self.build()

        self.assertEqual(report["period"]["current_week_start"], date(2026, 6, 8))
        self.assertEqual(report["period"]["current_week_end"], date(2026, 6, 14))
        self.assertEqual(report["period"]["previous_week_start"], date(2026, 6, 1))
        self.assertEqual(report["period"]["previous_week_end"], date(2026, 6, 7))

    def test_mode_warning_tab_switch_and_unique_day_metrics_are_correct(self):
        self.seed_current_and_previous()

        report = self.build()
        current = report["current_week"]

        self.assertEqual(current["deep_work_sessions"], 1)
        self.assertEqual(current["normal_sessions"], 2)
        self.assertEqual(current["total_warnings"], 2)
        self.assertEqual(current["average_warnings_per_session"], 0.67)
        self.assertEqual(current["total_tab_switches"], 6)
        self.assertEqual(current["unique_focus_days"], 2)
        self.assertEqual(current["most_common_distraction_domain"], "reddit.com")

    def test_week_over_week_comparison_and_percent_change_are_correct(self):
        self.seed_current_and_previous()

        report = self.build()
        comparison = report["comparison"]

        self.assertEqual(comparison["focus_minutes_delta"], 30)
        self.assertEqual(comparison["focus_hours_delta"], 0.5)
        self.assertEqual(comparison["focus_time_percent_change"], 50.0)
        self.assertEqual(comparison["average_score_delta"], 10.0)
        self.assertEqual(comparison["session_count_delta"], 1)
        self.assertEqual(comparison["deep_work_session_delta"], 0)
        self.assertEqual(comparison["warning_count_delta"], 0)

    def test_previous_zero_values_do_not_divide_by_zero(self):
        self.create_session(started_at=self.aware(2026, 6, 9), focus_score=80)

        report = self.build()

        self.assertIsNone(report["comparison"]["focus_time_percent_change"])
        self.assertEqual(report["focus_trend"]["direction"], "insufficient_data")

    def test_focus_trend_up_down_stable_and_insufficient(self):
        self.create_session(started_at=self.aware(2026, 6, 9), focus_score=83)
        self.create_session(started_at=self.aware(2026, 6, 2), focus_score=79)
        self.assertEqual(self.build()["focus_trend"]["direction"], "up")

        FocusSession.objects.all().delete()
        self.create_session(started_at=self.aware(2026, 6, 9), focus_score=70)
        self.create_session(started_at=self.aware(2026, 6, 2), focus_score=78)
        self.assertEqual(self.build()["focus_trend"]["direction"], "down")

        FocusSession.objects.all().delete()
        self.create_session(started_at=self.aware(2026, 6, 9), focus_score=80)
        self.create_session(started_at=self.aware(2026, 6, 2), focus_score=79)
        self.assertEqual(self.build()["focus_trend"]["direction"], "stable")

        FocusSession.objects.all().delete()
        self.create_session(started_at=self.aware(2026, 6, 9), focus_score=80)
        self.assertEqual(self.build()["focus_trend"]["direction"], "insufficient_data")

    def test_no_current_week_data_returns_valid_response(self):
        self.create_session(started_at=self.aware(2026, 6, 2), focus_score=80)

        report = self.build()

        self.assertEqual(report["status"], "no_current_week_data")
        self.assertFalse(report["data_complete"])
        self.assertFalse(report["personalized"])
        self.assertEqual(report["current_week"]["total_sessions"], 0)
        self.assertIsNone(report["comparison"])
        self.assertEqual(report["recommendations"], [])
        self.assertEqual(report["commentary"], [])

    def test_patterns_and_recommendations_are_reused_and_insufficient_data_is_not_faked(self):
        for index in range(2):
            self.create_session(
                started_at=self.aware(2026, 6, 9 + index),
                focus_score=80 + index,
            )

        report = self.build()

        self.assertEqual(report["patterns"]["status"], "insufficient_data")
        self.assertIsNone(report["patterns"]["best_time"])
        self.assertEqual(report["recommendations"], [])

    def test_pattern_detection_and_recommendation_engine_are_called_once(self):
        self.create_session(started_at=self.aware(2026, 6, 9), focus_score=80)
        pattern_data = {
            "status": "insufficient_data",
            "minimum_sessions": 5,
            "current_sessions": 1,
            "patterns": None,
        }

        with patch(
            "apps.recommendations.weekly_report_service.PatternDetectionService"
        ) as pattern_cls:
            with patch(
                "apps.recommendations.weekly_report_service.FocusRecommendationService"
            ) as recommendation_cls:
                pattern_cls.return_value.build.return_value = pattern_data
                recommendation_cls.return_value.build.return_value = {
                    "status": "insufficient_data",
                    "recommendations": [],
                    "smart_preset": None,
                }
                report = self.build()

        pattern_cls.assert_called_once()
        pattern_cls.return_value.build.assert_called_once()
        recommendation_cls.assert_called_once()
        recommendation_cls.return_value.build.assert_called_once()
        self.assertEqual(report["recommendations"], [])

    def test_commentary_reason_codes_are_deterministic(self):
        self.seed_current_and_previous()

        report = self.build()
        reason_codes = {item["reason_code"] for item in report["commentary"]}

        self.assertIn("focus_time_increased", reason_codes)
        self.assertIn("focus_score_improved", reason_codes)

    def test_report_does_not_expose_private_browser_fields_or_other_user_data(self):
        session, _, _ = self.seed_current_and_previous()
        self.create_warning(session, domain="private.example")

        with patch.object(AIClient, "complete_json") as complete_json:
            report = self.build()

        report_text = str(report)
        self.assertNotIn("https://", report_text)
        self.assertNotIn("Private title", report_text)
        self.assertNotIn("Private meta", report_text)
        self.assertNotIn("Private snippet", report_text)
        self.assertNotIn("999", report_text)
        complete_json.assert_not_called()


class WeeklyFocusReportTaskTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="weekly-task@example.com",
            password=PASSWORD,
        )

    def test_task_accepts_user_id_and_calls_service(self):
        with patch("apps.recommendations.tasks.WeeklyFocusReportService") as service_cls:
            service_cls.return_value.build.return_value = {"status": "ready"}

            result = generate_weekly_focus_report_task.run(
                str(self.user.id),
                reference_date="2026-06-13",
            )

        self.assertEqual(result["status"], "ready")
        service_cls.assert_called_once()
        called_user = service_cls.call_args.args[0]
        self.assertEqual(called_user.id, self.user.id)
        self.assertEqual(service_cls.call_args.kwargs["reference_date"], date(2026, 6, 13))

    def test_task_can_rerun_without_persistence_duplicates(self):
        first = generate_weekly_focus_report_task.run(str(self.user.id), "2026-06-13")
        second = generate_weekly_focus_report_task.run(str(self.user.id), "2026-06-13")

        self.assertEqual(first["status"], second["status"])


class WeeklySnapshotDev2IntegrationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="weekly-endpoint@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def test_weekly_snapshot_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/analytics/weekly-snapshot/")

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_weekly_snapshot_includes_dev2_fields_without_removing_legacy_contract(self):
        response = self.client.get("/api/analytics/weekly-snapshot/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("thisWeek", response.data)
        self.assertIn("lastWeek", response.data)
        self.assertIn("delta", response.data)
        self.assertIn("trendDirection", response.data)
        self.assertIn("current_week", response.data)
        self.assertIn("previous_week", response.data)
        self.assertIn("focus_trend", response.data)
        self.assertIn("patterns", response.data)
        self.assertIn("recommendations", response.data)
        self.assertIn("commentary", response.data)

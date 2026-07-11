from datetime import UTC, datetime, time, timedelta
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.ai.services.ai_client import AIClient
from apps.sessions.models import FocusSession

from apps.notifications.models import Notification
from apps.notifications.services import NotificationService
from apps.notifications.tasks import (
    generate_notification_for_user,
    process_daily_session_reminders,
    process_deep_work_suggestions,
    process_weekly_summary_notifications,
)


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


def aware(year, month, day, hour=9, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=UTC)


class NotificationTestMixin:
    def create_user(self, email="notify@example.com"):
        return User.objects.create_user(email=email, password=PASSWORD)

    def create_session(self, user, **overrides):
        started_at = overrides.pop("started_at", aware(2026, 6, 13, 9))
        actual_duration_seconds = overrides.pop("actual_duration_seconds", 1800)
        values = {
            "user": user,
            "mode": FocusSession.Mode.NORMAL,
            "status": FocusSession.Status.COMPLETED,
            "target_duration_seconds": 1800,
            "actual_duration_seconds": actual_duration_seconds,
            "focus_score": 80,
            "focus_state": "focused",
            "started_at": started_at,
            "ended_at": started_at + timedelta(seconds=actual_duration_seconds),
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def enable_all_notifications(self, user):
        preferences = user.preferences
        preferences.notifications_enabled = True
        preferences.session_reminder_enabled = True
        preferences.weekly_summary_enabled = True
        preferences.deep_work_suggestion_enabled = True
        preferences.session_reminder_time = time(20, 0)
        preferences.save()
        return preferences

    def service(self, now=None):
        return NotificationService(now=now or aware(2026, 6, 13, 20, 30))


class DailyReminderTests(NotificationTestMixin, APITestCase):
    def setUp(self):
        self.user = self.create_user()
        self.enable_all_notifications(self.user)

    def test_enabled_user_without_today_session_gets_reminder(self):
        notification, created = self.service().create_daily_session_reminder(self.user)

        self.assertTrue(created)
        self.assertEqual(notification.notification_type, Notification.Type.SESSION_REMINDER)
        self.assertEqual(notification.metadata["date"], "2026-06-13")

    def test_user_with_session_today_is_not_reminded(self):
        self.create_session(self.user, started_at=aware(2026, 6, 13, 9))

        notification, created = self.service().create_daily_session_reminder(self.user)

        self.assertIsNone(notification)
        self.assertFalse(created)

    def test_before_reminder_time_no_notification(self):
        notification, created = self.service(
            aware(2026, 6, 13, 19, 59)
        ).create_daily_session_reminder(self.user)

        self.assertIsNone(notification)
        self.assertFalse(created)

    def test_disabled_reminder_no_notification(self):
        self.user.preferences.session_reminder_enabled = False
        self.user.preferences.save()

        notification, created = self.service().create_daily_session_reminder(self.user)

        self.assertIsNone(notification)
        self.assertFalse(created)

    def test_one_reminder_per_user_per_day_and_task_rerun_no_duplicate(self):
        first = self.service().create_daily_session_reminder(self.user)
        second = self.service().create_daily_session_reminder(self.user)

        self.assertTrue(first[1])
        self.assertFalse(second[1])
        self.assertEqual(Notification.objects.count(), 1)

    def test_other_user_session_does_not_block_reminder(self):
        other_user = self.create_user("other-session@example.com")
        self.create_session(other_user, started_at=aware(2026, 6, 13, 9))

        notification, created = self.service().create_daily_session_reminder(self.user)

        self.assertIsNotNone(notification)
        self.assertTrue(created)

    def test_cancelled_started_session_counts_as_started_for_daily_rule(self):
        self.create_session(
            self.user,
            status=FocusSession.Status.CANCELLED,
            started_at=aware(2026, 6, 13, 9),
        )

        notification, created = self.service().create_daily_session_reminder(self.user)

        self.assertIsNone(notification)
        self.assertFalse(created)

    def test_user_timezone_is_applied(self):
        self.user.preferences.timezone = "Asia/Tokyo"
        now = aware(2026, 6, 13, 11, 5)

        notification, created = self.service(now).create_daily_session_reminder(self.user)

        self.assertTrue(created)
        self.assertEqual(notification.metadata["date"], "2026-06-13")

    def test_invalid_timezone_falls_back_safely(self):
        self.user.preferences.timezone = "Not/AZone"

        notification, created = self.service().create_daily_session_reminder(self.user)

        self.assertTrue(created)
        self.assertIsNotNone(notification)


class WeeklySummaryNotificationTests(NotificationTestMixin, APITestCase):
    def setUp(self):
        self.user = self.create_user("weekly@example.com")
        self.enable_all_notifications(self.user)
        self.monday = aware(2026, 6, 15, 9)

    @patch("apps.notifications.services.WeeklyFocusReportService")
    def test_weekly_summary_created_when_enabled(self, report_cls):
        report_cls.return_value.build.return_value = self.report_payload()

        notification, created = self.service(self.monday).create_weekly_summary_notification(
            self.user
        )

        self.assertTrue(created)
        self.assertEqual(notification.notification_type, Notification.Type.WEEKLY_SUMMARY)
        self.assertEqual(notification.metadata["week_start"], "2026-06-08")

    def test_user_disabled_no_weekly_notification(self):
        self.user.preferences.weekly_summary_enabled = False
        self.user.preferences.save()

        notification, created = self.service(self.monday).create_weekly_summary_notification(
            self.user
        )

        self.assertIsNone(notification)
        self.assertFalse(created)

    @patch("apps.notifications.services.WeeklyFocusReportService")
    def test_weekly_report_service_is_reused(self, report_cls):
        report_cls.return_value.build.return_value = self.report_payload()

        self.service(self.monday).create_weekly_summary_notification(self.user)

        report_cls.assert_called_once()

    @patch("apps.notifications.services.WeeklyFocusReportService")
    def test_weekly_summary_is_idempotent_per_week(self, report_cls):
        report_cls.return_value.build.return_value = self.report_payload()

        first = self.service(self.monday).create_weekly_summary_notification(self.user)
        second = self.service(self.monday).create_weekly_summary_notification(self.user)

        self.assertTrue(first[1])
        self.assertFalse(second[1])
        self.assertEqual(Notification.objects.count(), 1)

    @patch("apps.notifications.services.WeeklyFocusReportService")
    def test_no_baseline_does_not_crash_and_metadata_is_summary_only(self, report_cls):
        payload = self.report_payload()
        payload["focus_trend"]["direction"] = "insufficient_data"
        report_cls.return_value.build.return_value = payload

        notification, created = self.service(self.monday).create_weekly_summary_notification(
            self.user
        )

        self.assertTrue(created)
        self.assertIn("total_focus_minutes", notification.metadata)
        self.assertNotIn("current_week", notification.metadata)
        self.assertNotIn("patterns", notification.metadata)

    def report_payload(self):
        return {
            "current_week": {
                "start": timezone.datetime(2026, 6, 8).date(),
                "end": timezone.datetime(2026, 6, 14).date(),
                "total_focus_minutes": 420,
                "average_focus_score": 81.5,
            },
            "focus_trend": {"direction": "up"},
        }


class DeepWorkSuggestionTests(NotificationTestMixin, APITestCase):
    def setUp(self):
        self.user = self.create_user("deep@example.com")
        self.enable_all_notifications(self.user)
        self.now = aware(2026, 6, 13, 17, 30)

    def seed_two_weeks(self, count=5):
        days = [1, 2, 8, 9, 10]
        for index in range(count):
            self.create_session(
                self.user,
                mode=FocusSession.Mode.DEEP_WORK,
                focus_score=85,
                started_at=aware(2026, 6, days[index], 9),
            )

    def pattern_ready(self):
        return {
            "status": "ready",
            "session_count": 5,
            "period": {"range": "30d", "start": None, "end": self.now},
            "patterns": {
                "best_time": {
                    "label": "18:00-23:59",
                    "start_hour": 18,
                    "end_hour": 23,
                    "average_score": 86,
                    "session_count": 5,
                    "completion_rate": 100,
                    "total_focus_minutes": 250,
                },
                "best_duration": {
                    "label": "50-69",
                    "min_minutes": 50,
                    "max_minutes": 69,
                    "average_score": 86,
                    "session_count": 5,
                    "completion_rate": 100,
                    "average_actual_minutes": 50,
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

    def recommendation_ready(self):
        return {
            "status": "ready",
            "recommendations": [],
            "smart_preset": {
                "mode": "deep_work",
                "duration_minutes": 50,
                "break_minutes": 10,
                "preferred_time": None,
                "confidence": "medium",
                "personalized": True,
            },
        }

    def test_under_two_weeks_data_no_suggestion(self):
        for index in range(5):
            self.create_session(self.user, started_at=aware(2026, 6, 10 + index, 9))

        notification, created = self.service(self.now).create_deep_work_suggestion(
            self.user
        )

        self.assertIsNone(notification)
        self.assertFalse(created)

    def test_under_five_sessions_no_suggestion(self):
        self.seed_two_weeks(count=4)

        notification, created = self.service(self.now).create_deep_work_suggestion(
            self.user
        )

        self.assertIsNone(notification)
        self.assertFalse(created)

    @patch("apps.notifications.services.PatternDetectionService")
    def test_pattern_insufficient_no_suggestion(self, pattern_cls):
        self.seed_two_weeks()
        pattern_cls.return_value.build.return_value = {
            "status": "insufficient_data",
            "current_sessions": 5,
            "patterns": None,
        }

        notification, created = self.service(self.now).create_deep_work_suggestion(
            self.user
        )

        self.assertIsNone(notification)
        self.assertFalse(created)

    @patch("apps.notifications.services.FocusRecommendationService")
    @patch("apps.notifications.services.PatternDetectionService")
    def test_best_focus_time_creates_suggestion(self, pattern_cls, recommendation_cls):
        self.seed_two_weeks()
        pattern_cls.return_value.build.return_value = self.pattern_ready()
        recommendation_cls.return_value.build.return_value = self.recommendation_ready()

        notification, created = self.service(self.now).create_deep_work_suggestion(
            self.user
        )

        self.assertTrue(created)
        self.assertEqual(
            notification.notification_type,
            Notification.Type.DEEP_WORK_SUGGESTION,
        )
        self.assertEqual(notification.metadata["best_time_start"], 18)
        self.assertEqual(notification.metadata["recommended_duration_minutes"], 50)

    @patch("apps.notifications.services.PatternDetectionService")
    def test_outside_lead_time_no_suggestion(self, pattern_cls):
        self.seed_two_weeks()
        pattern_cls.return_value.build.return_value = self.pattern_ready()

        notification, created = self.service(
            aware(2026, 6, 13, 16, 0)
        ).create_deep_work_suggestion(self.user)

        self.assertIsNone(notification)
        self.assertFalse(created)

    def test_active_session_blocks_suggestion(self):
        self.seed_two_weeks()
        self.create_session(
            self.user,
            status=FocusSession.Status.ACTIVE,
            focus_score=None,
            focus_state="",
            started_at=aware(2026, 6, 13, 17),
        )

        notification, created = self.service(self.now).create_deep_work_suggestion(
            self.user
        )

        self.assertIsNone(notification)
        self.assertFalse(created)

    @patch("apps.notifications.services.FocusRecommendationService")
    @patch("apps.notifications.services.PatternDetectionService")
    def test_one_suggestion_per_day_and_services_are_reused(
        self,
        pattern_cls,
        recommendation_cls,
    ):
        self.seed_two_weeks()
        pattern_cls.return_value.build.return_value = self.pattern_ready()
        recommendation_cls.return_value.build.return_value = self.recommendation_ready()

        first = self.service(self.now).create_deep_work_suggestion(self.user)
        second = self.service(self.now).create_deep_work_suggestion(self.user)

        self.assertTrue(first[1])
        self.assertFalse(second[1])
        pattern_cls.assert_called()
        recommendation_cls.assert_called()
        self.assertEqual(Notification.objects.count(), 1)

    @patch.object(AIClient, "complete_json")
    @patch("apps.notifications.services.FocusRecommendationService")
    @patch("apps.notifications.services.PatternDetectionService")
    def test_deep_work_suggestion_does_not_call_external_ai(
        self,
        pattern_cls,
        recommendation_cls,
        complete_json,
    ):
        self.seed_two_weeks()
        pattern_cls.return_value.build.return_value = self.pattern_ready()
        recommendation_cls.return_value.build.return_value = self.recommendation_ready()

        self.service(self.now).create_deep_work_suggestion(self.user)

        complete_json.assert_not_called()


class NotificationTaskAndModelTests(NotificationTestMixin, APITestCase):
    def setUp(self):
        self.user = self.create_user("task@example.com")
        self.enable_all_notifications(self.user)

    def test_tasks_accept_primitive_values_and_batch_errors_do_not_abort(self):
        other = self.create_user("task-other@example.com")
        self.enable_all_notifications(other)

        with patch.object(
            NotificationService,
            "create_daily_session_reminder",
            side_effect=[RuntimeError("temporary"), (None, False)],
        ):
            result = NotificationService().process_daily_session_reminders()

        self.assertEqual(result["checked"], 2)
        self.assertEqual(result["created"], 0)

        with patch(
            "apps.notifications.tasks.NotificationService.create_daily_session_reminder",
            return_value=(None, False),
        ) as create:
            generate_notification_for_user.run(str(self.user.id), "session_reminder")

        create.assert_called_once()

    def test_batch_tasks_are_callable(self):
        with patch(
            "apps.notifications.tasks.NotificationService.process_daily_session_reminders",
            return_value={"checked": 1, "created": 0},
        ):
            self.assertEqual(process_daily_session_reminders.run()["checked"], 1)
        with patch(
            "apps.notifications.tasks.NotificationService.process_weekly_summary_notifications",
            return_value={"checked": 1, "created": 0},
        ):
            self.assertEqual(process_weekly_summary_notifications.run()["checked"], 1)
        with patch(
            "apps.notifications.tasks.NotificationService.process_deep_work_suggestions",
            return_value={"checked": 1, "created": 0},
        ):
            self.assertEqual(process_deep_work_suggestions.run()["checked"], 1)

    def test_celery_beat_schedule_registers_recurring_notification_and_cleanup_tasks(self):
        schedule = settings.CELERY_BEAT_SCHEDULE

        self.assertEqual(
            schedule["process-daily-session-reminders"]["task"],
            "apps.notifications.tasks.process_daily_session_reminders",
        )
        self.assertEqual(
            schedule["process-weekly-summary-notifications"]["task"],
            "apps.notifications.tasks.process_weekly_summary_notifications",
        )
        self.assertEqual(
            schedule["process-deep-work-suggestions"]["task"],
            "apps.notifications.tasks.process_deep_work_suggestions",
        )
        self.assertEqual(
            schedule["cleanup-expired-report-exports"]["task"],
            "apps.analytics.tasks.cleanup_expired_report_exports_task",
        )
        self.assertEqual(
            schedule["cleanup-expired-account-exports"]["task"],
            "apps.users.tasks.cleanup_expired_account_exports_task",
        )

    def test_dedupe_key_is_unique_and_ownership_choices_are_correct(self):
        Notification.objects.create(
            user=self.user,
            notification_type=Notification.Type.TEST,
            title="Test",
            message="Message",
            dedupe_key="same",
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Notification.objects.create(
                    user=self.user,
                    notification_type=Notification.Type.TEST,
                    title="Test",
                    message="Message",
                    dedupe_key="same",
                )

    def test_notification_metadata_does_not_include_private_browser_fields(self):
        notification, _ = self.service().create_once(
            user=self.user,
            notification_type=Notification.Type.TEST,
            title="Safe",
            message="Safe",
            dedupe_key="private-fields",
            metadata={
                "url": "https://example.com/private",
                "page_title": "Private title",
                "meta_description": "Private meta",
                "content_snippet": "Private snippet",
                "date": "2026-06-13",
            },
        )

        text = str(notification.metadata)
        self.assertIn("date", notification.metadata)
        self.assertNotIn("https://", text)
        self.assertNotIn("Private title", text)
        self.assertNotIn("Private meta", text)
        self.assertNotIn("Private snippet", text)


class NotificationTestAPITests(NotificationTestMixin, APITestCase):
    def setUp(self):
        self.user = self.create_user("api@example.com")
        self.other_user = self.create_user("api-other@example.com")
        self.client.force_authenticate(self.user)

    def test_authentication_required(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            "/api/notifications/test/",
            {"type": "session_reminder"},
            format="json",
        )

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_authenticated_user_creates_test_notification(self):
        response = self.client.post(
            "/api/notifications/test/",
            {"type": "session_reminder"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["test"])
        self.assertEqual(response.data["notification"]["type"], Notification.Type.TEST)
        self.assertEqual(
            response.data["notification"]["source_type"],
            Notification.Type.SESSION_REMINDER,
        )

    def test_invalid_type_returns_400(self):
        response = self.client.post(
            "/api/notifications/test/",
            {"type": "bad"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_client_cannot_choose_other_user_or_custom_text(self):
        response = self.client.post(
            "/api/notifications/test/",
            {
                "type": "weekly_summary",
                "user_id": str(self.other_user.id),
                "title": "Injected title",
                "message": "Injected message",
            },
            format="json",
        )

        notification = Notification.objects.get()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(notification.user_id, self.user.id)
        self.assertNotEqual(notification.title, "Injected title")
        self.assertNotEqual(notification.message, "Injected message")

    @patch.object(AIClient, "complete_json")
    @patch("apps.notifications.views.NotificationService.process_daily_session_reminders")
    def test_endpoint_does_not_run_batch_scheduler_or_external_ai(
        self,
        process_daily,
        complete_json,
    ):
        response = self.client.post(
            "/api/notifications/test/",
            {"type": "generic"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        process_daily.assert_not_called()
        complete_json.assert_not_called()

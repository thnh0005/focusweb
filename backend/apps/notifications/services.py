import logging
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.recommendations.services import (
    FocusRecommendationService,
    PatternDetectionService,
)
from apps.recommendations.weekly_report_service import WeeklyFocusReportService
from apps.sessions.models import FocusSession

from .models import Notification


logger = logging.getLogger(__name__)


class NotificationDeliveryBackend:
    def deliver(self, notification):
        if notification.status == Notification.Status.CREATED:
            notification.status = Notification.Status.DELIVERED
            notification.delivered_at = timezone.now()
            notification.save(update_fields=["status", "delivered_at"])
        return notification


class NotificationService:
    DEFAULT_REMINDER_TIME = time(20, 0)
    DEEP_WORK_LEAD_MINUTES = 30

    def __init__(self, now=None, delivery_backend=None):
        self.now = now or timezone.now()
        self.delivery_backend = delivery_backend or NotificationDeliveryBackend()

    def user_local_now(self, user):
        return timezone.localtime(self.now, self.user_timezone(user))

    def user_timezone(self, user):
        timezone_name = (
            self.value_from_related(user, "preferences", "timezone")
            or self.value_from_related(user, "profile", "timezone")
            or settings.TIME_ZONE
        )
        try:
            return ZoneInfo(timezone_name)
        except ZoneInfoNotFoundError:
            logger.warning("Invalid user timezone; falling back to Django TIME_ZONE.")
            return ZoneInfo(settings.TIME_ZONE)

    def value_from_related(self, user, related_name, field_name):
        related = getattr(user, related_name, None)
        return getattr(related, field_name, "") if related is not None else ""

    def is_notification_enabled(self, user, setting_name):
        preferences = getattr(user, "preferences", None)
        if preferences is None or not getattr(user, "is_active", True):
            return False
        return bool(
            getattr(preferences, "notifications_enabled", True)
            and getattr(preferences, setting_name, False)
        )

    def create_once(
        self,
        *,
        user,
        notification_type,
        title,
        message,
        dedupe_key,
        metadata=None,
        scheduled_for=None,
        deliver=True,
    ):
        safe_metadata = self.safe_metadata(metadata or {})
        try:
            with transaction.atomic():
                notification, created = Notification.objects.get_or_create(
                    dedupe_key=dedupe_key,
                    defaults={
                        "user": user,
                        "notification_type": notification_type,
                        "title": title,
                        "message": message,
                        "metadata": safe_metadata,
                        "scheduled_for": scheduled_for or self.now,
                        "status": Notification.Status.CREATED,
                    },
                )
        except IntegrityError:
            notification = Notification.objects.get(dedupe_key=dedupe_key)
            created = False

        if deliver and created:
            notification = self.delivery_backend.deliver(notification)
        return notification, created

    def safe_metadata(self, metadata):
        blocked_keys = {
            "url",
            "full_url",
            "page_title",
            "title_text",
            "meta_description",
            "content_snippet",
            "snippet",
            "prompt",
        }
        return {
            key: value
            for key, value in metadata.items()
            if key not in blocked_keys and not isinstance(value, (dict, list))
        }

    def create_daily_session_reminder(self, user):
        if not self.is_notification_enabled(user, "session_reminder_enabled"):
            return None, False

        local_now = self.user_local_now(user)
        reminder_time = (
            getattr(user.preferences, "session_reminder_time", None)
            or self.DEFAULT_REMINDER_TIME
        )
        if local_now.time() < reminder_time:
            return None, False

        local_day_start = datetime.combine(local_now.date(), time.min, local_now.tzinfo)
        local_day_end = local_day_start + timedelta(days=1)
        if FocusSession.objects.filter(
            user=user,
            started_at__gte=local_day_start.astimezone(UTC),
            started_at__lt=local_day_end.astimezone(UTC),
        ).exists():
            return None, False

        local_date = local_now.date().isoformat()
        return self.create_once(
            user=user,
            notification_type=Notification.Type.SESSION_REMINDER,
            title="Daily focus reminder",
            message="You have not started a focus session today.",
            dedupe_key=f"session_reminder:{user.id}:{local_date}",
            metadata={"date": local_date},
            scheduled_for=self.now,
        )

    def create_weekly_summary_notification(self, user):
        if not self.is_notification_enabled(user, "weekly_summary_enabled"):
            return None, False

        local_now = self.user_local_now(user)
        if local_now.weekday() != 0:
            return None, False
        report_reference_date = local_now.date() - timedelta(days=1)
        report = WeeklyFocusReportService(user, reference_date=report_reference_date).build()
        current_week = report["current_week"]
        week_start = current_week["start"].isoformat()
        week_end = current_week["end"].isoformat()
        focus_hours = round(current_week["total_focus_minutes"] / 60, 2)
        score = current_week["average_focus_score"]
        score_text = f" with average Focus Score {score}" if score is not None else ""

        return self.create_once(
            user=user,
            notification_type=Notification.Type.WEEKLY_SUMMARY,
            title="Weekly focus report is ready",
            message=(
                f"Your weekly focus report is ready: {focus_hours} focus hours"
                f"{score_text}."
            ),
            dedupe_key=f"weekly_summary:{user.id}:{week_start}",
            metadata={
                "week_start": week_start,
                "week_end": week_end,
                "total_focus_minutes": current_week["total_focus_minutes"],
                "average_focus_score": score,
                "focus_trend": report["focus_trend"]["direction"],
            },
            scheduled_for=self.now,
        )

    def create_deep_work_suggestion(self, user):
        if not self.is_notification_enabled(user, "deep_work_suggestion_enabled"):
            return None, False

        local_now = self.user_local_now(user)
        if not self.has_two_weeks_of_data(user, local_now.date()):
            return None, False
        if self.completed_scored_sessions(user).count() < 5:
            return None, False
        if FocusSession.objects.filter(
            user=user,
            status__in=FocusSession.OPEN_STATUSES,
        ).exists():
            return None, False

        pattern_data = PatternDetectionService(user, date_range="30d", now=self.now).build()
        if pattern_data["status"] != "ready":
            return None, False

        best_time = pattern_data["patterns"]["best_time"]
        if not best_time or best_time["session_count"] < 2:
            return None, False

        best_start = datetime.combine(
            local_now.date(),
            time(best_time["start_hour"], 0),
            local_now.tzinfo,
        )
        lead_start = best_start - timedelta(minutes=self.DEEP_WORK_LEAD_MINUTES)
        if not (lead_start <= local_now <= best_start):
            return None, False

        if FocusSession.objects.filter(
            user=user,
            started_at__gte=lead_start.astimezone(UTC),
            started_at__lte=local_now.astimezone(UTC),
        ).exists():
            return None, False

        recommendation = FocusRecommendationService(
            user,
            date_range="30d",
            now=self.now,
            pattern_data=pattern_data,
        ).build()
        preset = recommendation.get("smart_preset") or {}
        local_date = local_now.date().isoformat()
        duration = preset.get("duration_minutes") or 50
        mode = preset.get("mode") or "deep_work"

        return self.create_once(
            user=user,
            notification_type=Notification.Type.DEEP_WORK_SUGGESTION,
            title="Your best focus window is coming up",
            message=(
                f"You often focus best from {best_time['label']}. "
                "This may be a good time to start Deep Work."
            ),
            dedupe_key=f"deep_work_suggestion:{user.id}:{local_date}",
            metadata={
                "best_time_start": best_time["start_hour"],
                "best_time_end": best_time["end_hour"],
                "recommended_mode": mode,
                "recommended_duration_minutes": duration,
                "break_minutes": preset.get("break_minutes") or 10,
            },
            scheduled_for=self.now,
        )

    def completed_scored_sessions(self, user):
        return FocusSession.objects.filter(
            user=user,
            status=FocusSession.Status.COMPLETED,
            focus_score__isnull=False,
        )

    def has_two_weeks_of_data(self, user, local_date):
        user_tz = self.user_timezone(user)
        two_weeks_ago = datetime.combine(
            local_date - timedelta(days=14),
            time.min,
            user_tz,
        ).astimezone(UTC)
        one_week_ago = datetime.combine(
            local_date - timedelta(days=7),
            time.min,
            user_tz,
        ).astimezone(UTC)
        recent_sessions = self.completed_scored_sessions(user).filter(
            started_at__gte=one_week_ago,
        )
        previous_week_sessions = self.completed_scored_sessions(user).filter(
            started_at__gte=two_weeks_ago,
            started_at__lt=one_week_ago,
        )
        return recent_sessions.exists() and previous_week_sessions.exists()

    def create_test_notification(self, user, source_type):
        metadata = {"test": True, "source_type": source_type}
        return self.create_once(
            user=user,
            notification_type=Notification.Type.TEST,
            title="Test notification",
            message="Notification backend is working.",
            dedupe_key=f"test:{user.id}:{timezone.now().timestamp()}",
            metadata=metadata,
            scheduled_for=self.now,
        )

    def active_users(self):
        return (
            get_user_model()
            .objects.filter(is_active=True)
            .select_related("preferences", "profile")
        )

    def process_daily_session_reminders(self):
        return self.process_users("create_daily_session_reminder")

    def process_weekly_summary_notifications(self):
        return self.process_users("create_weekly_summary_notification")

    def process_deep_work_suggestions(self):
        return self.process_users("create_deep_work_suggestion")

    def process_users(self, method_name):
        created = 0
        checked = 0
        for user in self.active_users().iterator(chunk_size=200):
            checked += 1
            try:
                _, was_created = getattr(self, method_name)(user)
                if was_created:
                    created += 1
            except Exception:
                logger.exception("Notification generation failed for a user.")
        return {"checked": checked, "created": created}

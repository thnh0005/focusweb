from celery import shared_task

from .services import NotificationService


@shared_task
def process_daily_session_reminders():
    return NotificationService().process_daily_session_reminders()


@shared_task
def process_weekly_summary_notifications():
    return NotificationService().process_weekly_summary_notifications()


@shared_task
def process_deep_work_suggestions():
    return NotificationService().process_deep_work_suggestions()


@shared_task
def generate_notification_for_user(user_id, notification_type):
    from django.contrib.auth import get_user_model

    user = (
        get_user_model()
        .objects.select_related("preferences", "profile")
        .filter(pk=user_id)
        .first()
    )
    if user is None:
        return {
            "status": "skipped",
            "user_id": str(user_id),
            "error_code": "USER_NOT_FOUND",
            "created": False,
            "notification_id": None,
        }
    service = NotificationService()
    method_map = {
        "session_reminder": service.create_daily_session_reminder,
        "weekly_summary": service.create_weekly_summary_notification,
        "deep_work_suggestion": service.create_deep_work_suggestion,
    }
    if notification_type not in method_map:
        return {
            "status": "failed",
            "user_id": str(user_id),
            "error_code": "INVALID_NOTIFICATION_TYPE",
            "created": False,
            "notification_id": None,
        }
    notification, created = method_map[notification_type](user)
    return {
        "status": "ok",
        "created": created,
        "notification_id": str(notification.id) if notification else None,
    }

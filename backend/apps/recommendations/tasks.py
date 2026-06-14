import logging
from datetime import date

from celery import shared_task
from django.contrib.auth import get_user_model

from .weekly_report_service import WeeklyFocusReportService


logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2)
def generate_weekly_focus_report_task(self, user_id, reference_date=None):
    try:
        user = get_user_model().objects.get(pk=user_id)
        parsed_reference_date = (
            date.fromisoformat(reference_date) if reference_date else None
        )
        return WeeklyFocusReportService(
            user,
            reference_date=parsed_reference_date,
        ).build()
    except get_user_model().DoesNotExist:
        logger.info("Weekly focus report skipped because user was not found.")
        return {"status": "user_not_found"}
    except Exception as exc:
        logger.warning("Weekly focus report task failed safely.")
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))

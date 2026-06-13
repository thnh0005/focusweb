from celery import shared_task
from django.conf import settings

from .services.session_insight_service import (
    TRANSIENT_AI_ERRORS,
    SessionInsightService,
)


@shared_task
def debug_ai_worker_task():
    return {
        "status": "ok",
        "worker": "ai",
        "provider": "mock",
    }


@shared_task(bind=True, max_retries=settings.SESSION_INSIGHT_TASK_MAX_RETRIES)
def generate_session_insight(self, session_id):
    service = SessionInsightService()
    try:
        return service.generate(
            session_id,
            defer_transient_retry=(
                self.request.retries < settings.SESSION_INSIGHT_TASK_MAX_RETRIES
            ),
        )
    except TRANSIENT_AI_ERRORS as exc:
        raise self.retry(
            exc=exc,
            countdown=settings.SESSION_INSIGHT_TASK_RETRY_BACKOFF_SECONDS
            * (self.request.retries + 1),
        )

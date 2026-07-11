from celery import shared_task
from django.conf import settings

from apps.ai.document_parsers.exceptions import DocumentExtractionError
from apps.ai.models import StudyDocument
from apps.ai.services.document_extraction import DocumentExtractionService
from apps.ai.services.document_summary import DocumentSummaryError, DocumentSummaryService
from apps.ai.services.exceptions import AIServiceError
from apps.ai.services.flashcard_generation import (
    FlashcardGenerationError,
    FlashcardGenerationService,
)

from .services.session_insight_service import (
    TRANSIENT_AI_ERRORS,
    SessionInsightService,
)


@shared_task
def debug_ai_worker_task():
    return {
        "status": "ok",
        "worker": "ai",
        "provider": "celery_debug",
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


@shared_task(bind=True, max_retries=settings.DOCUMENT_EXTRACTION_TASK_MAX_RETRIES)
def extract_document_text(self, document_id, content=None, filename=None, mime_type="", force=False):
    service = DocumentExtractionService()
    try:
        return service.extract_document(
            document_id,
            content=content,
            filename=filename,
            mime_type=mime_type,
            force=force,
        )
    except DocumentExtractionError as exc:
        return {
            "status": "failed",
            "document_id": str(document_id),
            "error_code": exc.error_code,
            "message": exc.safe_message,
            "retryable": exc.retryable,
        }
    except Exception as exc:
        if self.request.retries >= settings.DOCUMENT_EXTRACTION_TASK_MAX_RETRIES:
            raise
        raise self.retry(
            exc=exc,
            countdown=settings.DOCUMENT_EXTRACTION_TASK_RETRY_BACKOFF_SECONDS
            * (self.request.retries + 1),
        )


@shared_task(bind=True, max_retries=settings.DOCUMENT_SUMMARY_TASK_MAX_RETRIES)
def generate_document_summary(self, document_id, mode, force=False):
    service = DocumentSummaryService()
    try:
        return service.generate(document_id, mode, force=force)
    except StudyDocument.DoesNotExist:
        return {
            "status": "skipped",
            "document_id": str(document_id),
            "mode": mode,
            "error_code": "DOCUMENT_NOT_FOUND",
            "message": "Document was not found.",
            "retryable": False,
        }
    except DocumentSummaryError as exc:
        return {
            "status": "failed",
            "document_id": str(document_id),
            "mode": mode,
            "error_code": exc.code,
            "message": exc.message,
            "retryable": False,
        }
    except AIServiceError as exc:
        if exc.retryable and self.request.retries < settings.DOCUMENT_SUMMARY_TASK_MAX_RETRIES:
            raise self.retry(
                exc=exc,
                countdown=settings.DOCUMENT_SUMMARY_TASK_RETRY_BACKOFF_SECONDS
                * (self.request.retries + 1),
            )
        return {
            "status": "failed",
            "document_id": str(document_id),
            "mode": mode,
            "error_code": exc.error_code,
            "message": exc.safe_message,
            "retryable": exc.retryable,
        }


@shared_task(bind=True, max_retries=settings.FLASHCARD_GENERATION_TASK_MAX_RETRIES)
def generate_document_flashcards(self, document_id, config, force=False):
    service = FlashcardGenerationService()
    try:
        return service.generate(document_id, config, force=force)
    except StudyDocument.DoesNotExist:
        return {
            "status": "skipped",
            "document_id": str(document_id),
            "error_code": "DOCUMENT_NOT_FOUND",
            "message": "Document was not found.",
            "retryable": False,
        }
    except FlashcardGenerationError as exc:
        return {
            "status": "failed",
            "document_id": str(document_id),
            "error_code": exc.code,
            "message": exc.message,
            "retryable": False,
        }
    except AIServiceError as exc:
        if exc.retryable and self.request.retries < settings.FLASHCARD_GENERATION_TASK_MAX_RETRIES:
            raise self.retry(
                exc=exc,
                countdown=settings.FLASHCARD_GENERATION_TASK_RETRY_BACKOFF_SECONDS
                * (self.request.retries + 1),
            )
        return {
            "status": "failed",
            "document_id": str(document_id),
            "error_code": exc.error_code,
            "message": exc.safe_message,
            "retryable": exc.retryable,
        }

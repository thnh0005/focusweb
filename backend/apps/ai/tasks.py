from celery import shared_task
from django.conf import settings

from apps.ai.document_parsers.exceptions import DocumentExtractionError
from apps.ai.models import DocumentAIJob, DocumentSummary, FlashcardDeck, StudyDocument
from apps.ai.services.document_extraction import DocumentExtractionService
from apps.ai.services.document_summary import DocumentSummaryError, DocumentSummaryService
from apps.ai.services.exceptions import AIQuotaDeferred, AIServiceError
from apps.ai.services.flashcard_generation import FlashcardGenerationError, FlashcardGenerationService
from apps.ai.services.document_ai_flow import DocumentAIFlow
from apps.ai.services.stale_recovery import StaleAIWorkRecoveryService

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


QUOTA_DEFER_EXHAUSTED_CODE = "AI_QUOTA_DEFERRED_EXHAUSTED"
QUOTA_DEFER_EXHAUSTED_MESSAGE = (
    "AI provider quota remained unavailable for too long. Please try again later."
)


@shared_task(bind=True, max_retries=settings.AI_QUOTA_DEFER_MAX_RETRIES)
def generate_session_insight(self, session_id):
    service = SessionInsightService()
    try:
        return service.generate(
            session_id,
            defer_transient_retry=(
                self.request.retries < settings.SESSION_INSIGHT_TASK_MAX_RETRIES
            ),
        )
    except AIQuotaDeferred as exc:
        if self.request.retries >= settings.AI_QUOTA_DEFER_MAX_RETRIES:
            return {
                "status": "failed",
                "session_id": str(session_id),
                "error_code": QUOTA_DEFER_EXHAUSTED_CODE,
                "message": QUOTA_DEFER_EXHAUSTED_MESSAGE,
                "retryable": True,
            }
        raise self.retry(exc=exc, countdown=exc.retry_after_seconds)
    except TRANSIENT_AI_ERRORS as exc:
        if self.request.retries >= settings.SESSION_INSIGHT_TASK_MAX_RETRIES:
            raise
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


@shared_task(bind=True, max_retries=settings.AI_QUOTA_DEFER_MAX_RETRIES)
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
    except AIQuotaDeferred as exc:
        if self.request.retries >= settings.AI_QUOTA_DEFER_MAX_RETRIES:
            return fail_deferred_document_summary(document_id, mode)
        raise self.retry(exc=exc, countdown=exc.retry_after_seconds)
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


@shared_task(bind=True, max_retries=settings.AI_QUOTA_DEFER_MAX_RETRIES)
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
    except AIQuotaDeferred as exc:
        if self.request.retries >= settings.AI_QUOTA_DEFER_MAX_RETRIES:
            return fail_deferred_flashcard_deck(document_id, config)
        retry_config = dict(config or {})
        retry_config["force"] = False
        raise self.retry(
            exc=exc,
            countdown=exc.retry_after_seconds,
            args=(document_id, retry_config),
            kwargs={"force": False},
        )
    except AIServiceError as exc:
        if exc.retryable and self.request.retries < settings.FLASHCARD_GENERATION_TASK_MAX_RETRIES:
            retry_config = dict(config or {})
            retry_config["force"] = False
            raise self.retry(
                exc=exc,
                countdown=settings.FLASHCARD_GENERATION_TASK_RETRY_BACKOFF_SECONDS
                * (self.request.retries + 1),
                args=(document_id, retry_config),
                kwargs={"force": False},
            )
        return {
            "status": "failed",
            "document_id": str(document_id),
            "error_code": exc.error_code,
            "message": exc.safe_message,
            "retryable": exc.retryable,
        }


@shared_task(bind=True)
def recover_stale_ai_work(self):
    del self
    return StaleAIWorkRecoveryService().recover()


@shared_task(bind=True, acks_late=True, reject_on_worker_lost=True)
def start_document_ai_job(self, job_id):
    try:
        return DocumentAIFlow().start(job_id)
    except DocumentAIJob.DoesNotExist:
        return skipped_legacy_job(job_id)


@shared_task(bind=True, acks_late=True, reject_on_worker_lost=True)
def process_next_document_chunk(self, job_id):
    try:
        return DocumentAIFlow().process_next_chunk(job_id)
    except DocumentAIJob.DoesNotExist:
        return skipped_legacy_job(job_id)


@shared_task(bind=True, acks_late=True, reject_on_worker_lost=True)
def process_reduction_step(self, job_id):
    try:
        return DocumentAIFlow().generate_summary(job_id)
    except DocumentAIJob.DoesNotExist:
        return skipped_legacy_job(job_id)


@shared_task(bind=True, acks_late=True, reject_on_worker_lost=True)
def generate_document_short_summary(self, job_id):
    try:
        return DocumentAIFlow().generate_summary(job_id)
    except DocumentAIJob.DoesNotExist:
        return skipped_legacy_job(job_id)


@shared_task(bind=True, acks_late=True, reject_on_worker_lost=True)
def generate_document_ai_flashcards(self, job_id):
    try:
        return DocumentAIFlow().generate_flashcards(job_id)
    except DocumentAIJob.DoesNotExist:
        return skipped_legacy_job(job_id)


@shared_task(bind=True, acks_late=True, reject_on_worker_lost=True)
def finalize_document_ai_job(self, job_id):
    try:
        return DocumentAIFlow().finalize(job_id)
    except DocumentAIJob.DoesNotExist:
        return skipped_legacy_job(job_id)


def fail_deferred_document_summary(document_id, mode):
    summary = (
        DocumentSummary.objects.filter(
            document_id=document_id,
            mode=mode,
            status__in=[DocumentSummary.Status.PENDING, DocumentSummary.Status.PROCESSING],
        )
        .order_by("-updated_at")
        .first()
    )
    if summary:
        summary.status = DocumentSummary.Status.FAILED
        summary.error_code = QUOTA_DEFER_EXHAUSTED_CODE
        summary.error_message = QUOTA_DEFER_EXHAUSTED_MESSAGE
        summary.save(update_fields=["status", "error_code", "error_message", "updated_at"])
    return {
        "status": "failed",
        "document_id": str(document_id),
        "mode": mode,
        "error_code": QUOTA_DEFER_EXHAUSTED_CODE,
        "message": QUOTA_DEFER_EXHAUSTED_MESSAGE,
        "retryable": True,
    }


def fail_deferred_flashcard_deck(document_id, config):
    query = FlashcardDeck.objects.filter(
        document_id=document_id,
        status__in=[FlashcardDeck.Status.PENDING, FlashcardDeck.Status.PROCESSING],
    )
    try:
        normalized = FlashcardGenerationService().normalize_config(config)
    except Exception:
        normalized = {}
    if normalized:
        query = query.filter(
            difficulty=normalized["difficulty"],
            requested_quantity=normalized["quantity"],
        )
    deck = query.order_by("-updated_at").first()
    if deck:
        deck.status = FlashcardDeck.Status.FAILED
        deck.error_code = QUOTA_DEFER_EXHAUSTED_CODE
        deck.error_message = QUOTA_DEFER_EXHAUSTED_MESSAGE
        deck.save(update_fields=["status", "error_code", "error_message", "updated_at"])
    return {
        "status": "failed",
        "document_id": str(document_id),
        "error_code": QUOTA_DEFER_EXHAUSTED_CODE,
        "message": QUOTA_DEFER_EXHAUSTED_MESSAGE,
        "retryable": True,
    }


def skipped_legacy_job(job_id):
    return {
        "status": "skipped",
        "job_id": str(job_id),
        "error_code": "DOCUMENT_AI_JOB_NOT_FOUND",
        "message": "Legacy document AI job was not found.",
        "retryable": False,
    }

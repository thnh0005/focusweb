from django.db import transaction
from django.utils import timezone

from apps.ai.models import StudyDocument
from apps.ai.services.observability import log_ai_event


EXTRACTION_ENQUEUE_FAILED = "EXTRACTION_ENQUEUE_FAILED"


def enqueue_document_extraction_task(
    document_id,
    *,
    previous_status="",
    recovery_action="upload_enqueue",
    attempt=None,
):
    try:
        from apps.ai.tasks import extract_document_text

        extract_document_text.delay(str(document_id))
    except Exception as exc:
        update_enqueue_metadata(
            document_id,
            status="failed",
            error_code=EXTRACTION_ENQUEUE_FAILED,
            error_message="Document extraction could not be queued. It will be retried by recovery.",
        )
        log_ai_event(
            "document_extraction_enqueue_failed",
            operation="document_extraction_enqueue",
            document_id=str(document_id),
            previous_status=previous_status,
            recovery_action=recovery_action,
            attempt=attempt,
            error_code=EXTRACTION_ENQUEUE_FAILED,
            retryable=True,
        )
        return False

    update_enqueue_metadata(document_id, status="queued")
    log_ai_event(
        "document_extraction_enqueued",
        operation="document_extraction_enqueue",
        document_id=str(document_id),
        previous_status=previous_status,
        recovery_action=recovery_action,
        attempt=attempt,
        status="queued",
    )
    return True


def schedule_document_extraction_after_commit(
    document_id,
    *,
    previous_status="",
    recovery_action="upload_enqueue",
    attempt=None,
):
    transaction.on_commit(
        lambda: enqueue_document_extraction_task(
            str(document_id),
            previous_status=previous_status,
            recovery_action=recovery_action,
            attempt=attempt,
        )
    )


def update_enqueue_metadata(document_id, *, status, error_code="", error_message=""):
    try:
        with transaction.atomic():
            document = StudyDocument.objects.select_for_update().get(pk=document_id)
            if document.status in {StudyDocument.Status.READY, StudyDocument.Status.ERROR}:
                return
            metadata = document.metadata or {}
            extraction = metadata.get("extraction", {})
            now = timezone.now().isoformat()
            extraction["enqueue_status"] = status
            extraction["last_enqueue_attempt_at"] = now
            extraction["enqueue_attempts"] = int(extraction.get("enqueue_attempts") or 0) + 1
            extraction["enqueue_error_code"] = error_code
            extraction["enqueue_error_message"] = str(error_message or "")[:500]
            if status == "queued":
                extraction.setdefault("status", "pending")
                extraction["queued_at"] = now
            metadata["extraction"] = extraction
            document.metadata = metadata
            document.save(update_fields=["metadata"])
    except StudyDocument.DoesNotExist:
        return

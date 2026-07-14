from datetime import datetime, timedelta, timezone as dt_timezone

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.ai.models import DocumentAIJob, DocumentSummary, FlashcardDeck, StudyDocument
from apps.ai.services.observability import log_ai_event


STALE_PROCESSING_RECOVERED = "STALE_PROCESSING_RECOVERED"
STALE_PROCESSING_FAILED = "STALE_PROCESSING_FAILED"


class StaleAIWorkRecoveryService:
    def __init__(self, now=None):
        self.now = now or timezone.now()
        self.max_recovery_attempts = settings.AI_JOB_MAX_RECOVERY_ATTEMPTS
        self.document_max_recovery_attempts = settings.DOCUMENT_EXTRACTION_MAX_RECOVERY_ATTEMPTS

    def recover(self):
        result = {
            "documents": self.recover_documents(),
            "summaries": self.recover_summaries(),
            "flashcard_decks": self.recover_flashcard_decks(),
            "document_ai_jobs": self.recover_document_ai_jobs(),
        }
        log_ai_event(
            "ai_stale_recovery_completed",
            operation="stale_recovery",
            status="completed",
            recovered_count=sum(item["recovered"] for item in result.values()),
            failed_count=sum(item["failed"] for item in result.values()),
            skipped_count=sum(item["skipped"] for item in result.values()),
        )
        return result

    def recover_documents(self):
        processing_cutoff = self.now - timedelta(seconds=settings.DOCUMENT_EXTRACTION_STALE_SECONDS)
        uploaded_cutoff = self.now - timedelta(seconds=settings.DOCUMENT_UPLOADED_GRACE_SECONDS)
        stale_ids = list(
            StudyDocument.objects.filter(
                status__in=[
                    StudyDocument.Status.UPLOADED,
                    StudyDocument.Status.PROCESSING,
                ]
            ).values_list("id", flat=True)
        )
        counts = self.empty_counts()
        for document_id in stale_ids:
            with transaction.atomic():
                document = StudyDocument.objects.select_for_update().get(pk=document_id)
                if document.status == StudyDocument.Status.UPLOADED:
                    handled = self.recover_uploaded_document(document, uploaded_cutoff)
                elif document.status == StudyDocument.Status.PROCESSING:
                    handled = self.recover_processing_document(document, processing_cutoff)
                else:
                    handled = "skipped"
                counts[handled] += 1
        return counts

    def recover_uploaded_document(self, document, cutoff):
        metadata = document.metadata or {}
        extraction = metadata.get("extraction", {})
        if not self.uploaded_before(document, extraction, cutoff):
            return "skipped"
        recovery_attempts = int(extraction.get("recovery_attempts") or 0)
        if recovery_attempts >= self.document_max_recovery_attempts:
            self.fail_document_extraction(document, extraction, metadata, previous_status=document.status)
            return "failed"
        next_attempt = recovery_attempts + 1
        extraction.update(
            {
                "status": extraction.get("status") or "pending",
                "error_code": STALE_PROCESSING_RECOVERED,
                "error_message": "Document extraction queue attempt was recovered.",
                "recovery_attempts": next_attempt,
                "last_recovery_action": "enqueue_uploaded",
                "recovered_at": self.now.isoformat(),
                "last_enqueue_attempt_at": self.now.isoformat(),
            }
        )
        metadata["extraction"] = extraction
        document.metadata = metadata
        document.save(update_fields=["metadata"])
        transaction.on_commit(
            lambda document_id=str(document.id), attempt=next_attempt: self.enqueue_extraction(
                document_id,
                previous_status=StudyDocument.Status.UPLOADED,
                recovery_action="enqueue_uploaded",
                attempt=attempt,
            )
        )
        self.log_record("document_extraction", document.id, "recovered", StudyDocument.Status.UPLOADED, "enqueue_uploaded", next_attempt)
        return "recovered"

    def recover_processing_document(self, document, cutoff):
        metadata = document.metadata or {}
        extraction = metadata.get("extraction", {})
        if not self.started_before(extraction, cutoff):
            return "skipped"
        recovery_attempts = int(extraction.get("recovery_attempts") or 0)
        if recovery_attempts >= self.document_max_recovery_attempts:
            self.fail_document_extraction(document, extraction, metadata, previous_status=document.status)
            return "failed"

        next_attempt = recovery_attempts + 1
        extraction.update(
            {
                "status": "pending",
                "error_code": STALE_PROCESSING_RECOVERED,
                "error_message": "Document extraction was interrupted and has been re-queued.",
                "recovery_attempts": next_attempt,
                "last_recovery_action": "requeue_processing",
                "recovered_at": self.now.isoformat(),
                "last_enqueue_attempt_at": self.now.isoformat(),
            }
        )
        metadata["extraction"] = extraction
        document.status = StudyDocument.Status.UPLOADED
        document.metadata = metadata
        document.save(update_fields=["status", "metadata"])
        transaction.on_commit(
            lambda document_id=str(document.id), attempt=next_attempt: self.enqueue_extraction(
                document_id,
                previous_status=StudyDocument.Status.PROCESSING,
                recovery_action="requeue_processing",
                attempt=attempt,
            )
        )
        self.log_record("document_extraction", document.id, "recovered", StudyDocument.Status.PROCESSING, "requeue_processing", next_attempt)
        return "recovered"

    def fail_document_extraction(self, document, extraction, metadata, previous_status):
        extraction.update(
            {
                "status": "failed",
                "error_code": STALE_PROCESSING_FAILED,
                "error_message": "Document extraction was interrupted and could not be recovered.",
                "last_recovery_action": "fail_exhausted_attempts",
                "failed_at": self.now.isoformat(),
            }
        )
        metadata["extraction"] = extraction
        document.status = StudyDocument.Status.ERROR
        document.processed_at = self.now
        document.metadata = metadata
        document.save(update_fields=["status", "processed_at", "metadata"])
        self.log_record(
            "document_extraction",
            document.id,
            "failed",
            previous_status,
            "fail_exhausted_attempts",
            int(extraction.get("recovery_attempts") or 0),
        )

    def recover_summaries(self):
        cutoff = self.now - timedelta(seconds=settings.AI_JOB_STALE_PROCESSING_SECONDS)
        counts = self.empty_counts()
        stale_ids = list(
            DocumentSummary.objects.filter(
                status=DocumentSummary.Status.PROCESSING,
                updated_at__lt=cutoff,
            ).values_list("id", flat=True)
        )
        for summary_id in stale_ids:
            with transaction.atomic():
                summary = DocumentSummary.objects.select_for_update().select_related("document").get(pk=summary_id)
                if summary.status != DocumentSummary.Status.PROCESSING:
                    counts["skipped"] += 1
                    continue
                if summary.generation_attempts >= self.max_recovery_attempts:
                    summary.status = DocumentSummary.Status.FAILED
                    summary.error_code = STALE_PROCESSING_FAILED
                    summary.error_message = "Summary generation was interrupted and could not be recovered."
                    summary.save(update_fields=["status", "error_code", "error_message", "updated_at"])
                    counts["failed"] += 1
                    self.log_record("document_summary", summary.id, "failed")
                    continue
                summary.status = DocumentSummary.Status.PENDING
                summary.error_code = STALE_PROCESSING_RECOVERED
                summary.error_message = "Summary generation was interrupted and has been re-queued."
                summary.save(update_fields=["status", "error_code", "error_message", "updated_at"])
                transaction.on_commit(
                    lambda document_id=str(summary.document_id), mode=summary.mode: self.enqueue_summary(
                        document_id,
                        mode,
                    )
                )
                counts["recovered"] += 1
                self.log_record("document_summary", summary.id, "recovered")
        return counts

    def recover_flashcard_decks(self):
        cutoff = self.now - timedelta(seconds=settings.AI_JOB_STALE_PROCESSING_SECONDS)
        counts = self.empty_counts()
        stale_ids = list(
            FlashcardDeck.objects.filter(
                status=FlashcardDeck.Status.PROCESSING,
                updated_at__lt=cutoff,
            ).values_list("id", flat=True)
        )
        for deck_id in stale_ids:
            with transaction.atomic():
                deck = FlashcardDeck.objects.select_for_update().get(pk=deck_id)
                if deck.status != FlashcardDeck.Status.PROCESSING:
                    counts["skipped"] += 1
                    continue
                if deck.generation_attempts >= self.max_recovery_attempts:
                    deck.status = FlashcardDeck.Status.FAILED
                    deck.error_code = STALE_PROCESSING_FAILED
                    deck.error_message = "Flashcard generation was interrupted and could not be recovered."
                    deck.save(update_fields=["status", "error_code", "error_message", "updated_at"])
                    counts["failed"] += 1
                    self.log_record("flashcard_deck", deck.id, "failed")
                    continue
                config = self.flashcard_config(deck)
                deck.status = FlashcardDeck.Status.PENDING
                deck.error_code = STALE_PROCESSING_RECOVERED
                deck.error_message = "Flashcard generation was interrupted and has been re-queued."
                deck.save(update_fields=["status", "error_code", "error_message", "updated_at"])
                transaction.on_commit(
                    lambda document_id=str(deck.document_id), config=config: self.enqueue_flashcards(
                        document_id,
                        config,
                    )
                )
                counts["recovered"] += 1
                self.log_record("flashcard_deck", deck.id, "recovered")
        return counts

    def recover_document_ai_jobs(self):
        cutoff = self.now - timedelta(seconds=settings.AI_JOB_STALE_PROCESSING_SECONDS)
        processing_statuses = [
            status
            for status, _label in DocumentAIJob.Status.choices
            if status not in DocumentAIJob.TERMINAL_STATUSES and status != DocumentAIJob.Status.PENDING
        ]
        counts = self.empty_counts()
        stale_ids = list(
            DocumentAIJob.objects.filter(
                status__in=processing_statuses,
                updated_at__lt=cutoff,
            ).values_list("id", flat=True)
        )
        for job_id in stale_ids:
            with transaction.atomic():
                job = DocumentAIJob.objects.select_for_update().get(pk=job_id)
                if job.status in DocumentAIJob.TERMINAL_STATUSES:
                    counts["skipped"] += 1
                    continue
                if job.attempt_count >= self.max_recovery_attempts:
                    job.status = DocumentAIJob.Status.FAILED
                    job.error_code = STALE_PROCESSING_FAILED
                    job.error_message = "Document AI job was interrupted and could not be recovered."
                    job.completed_at = self.now
                    job.save(update_fields=["status", "error_code", "error_message", "completed_at", "updated_at"])
                    counts["failed"] += 1
                    self.log_record("document_ai_job", job.id, "failed")
                    continue
                job.status = DocumentAIJob.Status.PENDING
                job.error_code = STALE_PROCESSING_RECOVERED
                job.error_message = "Document AI job was interrupted and has been re-queued."
                job.attempt_count += 1
                job.next_ai_request_at = None
                job.save(
                    update_fields=[
                        "status",
                        "error_code",
                        "error_message",
                        "attempt_count",
                        "next_ai_request_at",
                        "updated_at",
                    ]
                )
                transaction.on_commit(lambda job_id=str(job.id): self.enqueue_document_ai_job(job_id))
                counts["recovered"] += 1
                self.log_record("document_ai_job", job.id, "recovered")
        return counts

    def started_before(self, extraction, cutoff):
        started_at = self.parse_datetime(
            extraction.get("started_at")
            or extraction.get("queued_at")
            or extraction.get("recovered_at")
        )
        return bool(started_at and started_at < cutoff)

    def uploaded_before(self, document, extraction, cutoff):
        last_attempt = self.parse_datetime(
            extraction.get("last_enqueue_attempt_at")
            or extraction.get("queued_at")
        )
        reference = last_attempt or document.uploaded_at
        return bool(reference and reference < cutoff)

    def parse_datetime(self, value):
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
        if timezone.is_naive(parsed):
            return timezone.make_aware(parsed, timezone=dt_timezone.utc)
        return parsed

    def flashcard_config(self, deck):
        scope = deck.scope or {"type": "full_document"}
        config = {
            "scope": scope.get("type", "full_document"),
            "quantity": deck.requested_quantity or deck.quantity or 10,
            "difficulty": deck.difficulty,
        }
        if config["scope"] == "page_range":
            config["page_start"] = scope.get("page_start") or (deck.page_range or {}).get("start")
            config["page_end"] = scope.get("page_end") or (deck.page_range or {}).get("end")
        if config["scope"] == "section":
            config["section_start"] = scope.get("section_start")
            config["section_end"] = scope.get("section_end")
        return config

    def enqueue_extraction(
        self,
        document_id,
        previous_status="",
        recovery_action="stale_recovery",
        attempt=None,
    ):
        from apps.ai.services.extraction_queue import enqueue_document_extraction_task

        return enqueue_document_extraction_task(
            str(document_id),
            previous_status=previous_status,
            recovery_action=recovery_action,
            attempt=attempt,
        )

    def enqueue_summary(self, document_id, mode):
        from apps.ai.tasks import generate_document_summary

        generate_document_summary.delay(str(document_id), mode, force=True)

    def enqueue_flashcards(self, document_id, config):
        from apps.ai.tasks import generate_document_flashcards

        generate_document_flashcards.delay(str(document_id), config, force=False)

    def enqueue_document_ai_job(self, job_id):
        from apps.ai.tasks import start_document_ai_job

        start_document_ai_job.delay(str(job_id))

    def log_record(
        self,
        record_type,
        record_id,
        status,
        previous_status="",
        recovery_action="",
        attempt=None,
    ):
        log_ai_event(
            "ai_stale_recovery_record",
            operation="stale_recovery",
            record_type=record_type,
            record_id=str(record_id),
            document_id=str(record_id) if record_type == "document_extraction" else "",
            previous_status=previous_status,
            recovery_action=recovery_action,
            attempt=attempt,
            status=status,
        )

    def empty_counts(self):
        return {"recovered": 0, "failed": 0, "skipped": 0}

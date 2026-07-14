import json
import math
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.ai.models import (
    DocumentAIChunk,
    DocumentAIJob,
    DocumentSummary,
    Flashcard,
    FlashcardDeck,
    StudyDocument,
)
from apps.ai.services.ai_client import AIClient
from apps.ai.services.document_summary import (
    CHUNK_RESERVED_OUTPUT_TOKENS,
    PROMPT_VERSION as SUMMARY_PROMPT_VERSION,
    DocumentChunk,
    DocumentChunker,
    DocumentContextOutputValidator,
    DocumentSummaryOutputValidator,
    DocumentSummaryService,
    RequestTokenBudget,
    RollingDocumentContext,
    reserved_output_tokens_for,
)
from apps.ai.services.exceptions import (
    AIAuthError,
    AIInvalidResponse,
    AIProviderError,
    AIProviderUnavailable,
    AIRateLimited,
    AIServiceError,
    AITimeout,
)
from apps.ai.services.flashcard_generation import (
    FLASHCARD_RESERVED_OUTPUT_TOKENS,
    PROMPT_VERSION as FLASHCARD_PROMPT_VERSION,
    DocumentSourceSelector,
    FlashcardGenerationService,
    FlashcardOutputValidator,
)
from apps.ai.services.prompt_builder import DocumentSummaryPromptBuilder, FlashcardPromptBuilder
from apps.ai.services.token_counter import PreparedAIRequest


DOCUMENT_AI_RATE_LIMIT_SECONDS = 60
TERMINAL_JOB_STATUSES = {
    DocumentAIJob.Status.COMPLETED,
    DocumentAIJob.Status.FAILED,
    DocumentAIJob.Status.CANCELLED,
}


def create_or_resume_document_ai_job(document):
    checksum = DocumentSummaryService().current_checksum(document)
    with transaction.atomic():
        job, created = DocumentAIJob.objects.select_for_update().get_or_create(
            document=document,
            defaults={
                "user": document.user,
                "source_checksum": checksum,
                "status": DocumentAIJob.Status.PENDING,
            },
        )
        if (
            not created
            and job.status == DocumentAIJob.Status.COMPLETED
            and job.source_checksum == checksum
        ):
            return job, False
        if not created and job.status not in TERMINAL_JOB_STATUSES:
            return job, False
        job.user = document.user
        job.source_checksum = checksum
        job.status = DocumentAIJob.Status.PENDING
        job.current_operation = ""
        job.current_chunk_index = 0
        job.total_chunks = 0
        job.completed_chunks = 0
        job.rolling_context_summary = ""
        job.entity_memory_json = {}
        job.open_context_json = []
        job.chunk_summaries_json = []
        job.flashcard_candidates_json = []
        job.summary_status = DocumentSummary.Status.PENDING
        job.flashcard_status = FlashcardDeck.Status.PENDING
        job.notification_status = DocumentAIJob.NotificationStatus.PENDING
        job.summary = None
        job.flashcard_deck = None
        job.error_code = ""
        job.error_message = ""
        job.started_at = timezone.now()
        job.completed_at = None
        job.save()
        job.chunks.all().delete()
        return job, True


def progress_payload(job):
    progress = 0
    if job.total_chunks:
        progress = min(70, round((job.completed_chunks / job.total_chunks) * 70))
    if job.summary_status == DocumentSummary.Status.COMPLETED:
        progress = max(progress, 85)
    if job.flashcard_status == FlashcardDeck.Status.COMPLETED:
        progress = max(progress, 95)
    if job.status == DocumentAIJob.Status.COMPLETED:
        progress = 100
    return {
        "job_id": str(job.id),
        "document_id": str(job.document_id),
        "status": job.status,
        "current_step": current_step(job),
        "current_chunk": job.current_chunk_index,
        "total_chunks": job.total_chunks,
        "completed_chunks": job.completed_chunks,
        "progress_percent": progress,
        "next_request_at": job.next_ai_request_at.isoformat() if job.next_ai_request_at else None,
        "summary_ready": job.summary_status == DocumentSummary.Status.COMPLETED,
        "flashcards_ready": job.flashcard_status == FlashcardDeck.Status.COMPLETED,
        "error_code": job.error_code or None,
        "error_message": job.error_message or None,
    }


def current_step(job):
    if job.status == DocumentAIJob.Status.PROCESSING_CHUNKS:
        return f"Đang phân tích phần {job.current_chunk_index}/{job.total_chunks}"
    if job.status == DocumentAIJob.Status.GENERATING_SUMMARY:
        return "Đang tạo bản tóm tắt"
    if job.status == DocumentAIJob.Status.GENERATING_FLASHCARDS:
        return "Đang tạo 10 flashcard"
    if job.status == DocumentAIJob.Status.COMPLETED:
        return "Đã hoàn tất"
    if job.status == DocumentAIJob.Status.FAILED:
        return "Xử lý thất bại"
    return "Đang chuẩn bị tài liệu"


def claim_ai_slot_or_reschedule(job_id, task, *args):
    with transaction.atomic():
        job = DocumentAIJob.objects.select_for_update().get(id=job_id)
        if job.status in TERMINAL_JOB_STATUSES:
            return None
        now = timezone.now()
        if job.next_ai_request_at and now < job.next_ai_request_at:
            delay = max(1, math.ceil((job.next_ai_request_at - now).total_seconds()))
            transaction.on_commit(lambda: task.apply_async(args=args or [str(job.id)], countdown=delay))
            return None
        job.last_ai_request_at = now
        job.next_ai_request_at = now + timedelta(seconds=DOCUMENT_AI_RATE_LIMIT_SECONDS)
        job.save(update_fields=["last_ai_request_at", "next_ai_request_at", "updated_at"])
        return job


def retry_delay(job, exc=None):
    base = DOCUMENT_AI_RATE_LIMIT_SECONDS
    if getattr(exc, "retry_after_seconds", None):
        return max(1, int(exc.retry_after_seconds))
    if isinstance(exc, AIRateLimited):
        return max(base, seconds_until_next_slot(job))
    if isinstance(exc, (AITimeout, AIProviderUnavailable)):
        return max(base * max(1, 2 ** max(0, job.attempt_count - 1)), seconds_until_next_slot(job))
    return max(base, seconds_until_next_slot(job))


def seconds_until_next_slot(job):
    if not job.next_ai_request_at:
        return 0
    return max(0, math.ceil((job.next_ai_request_at - timezone.now()).total_seconds()))


class DocumentAIFlow:
    summary_mode = DocumentSummary.Mode.DETAILED

    def __init__(self):
        self.summary_builder = DocumentSummaryPromptBuilder()
        self.summary_validator = DocumentSummaryOutputValidator()
        self.context_validator = DocumentContextOutputValidator(self.summary_validator)
        self.flashcard_builder = FlashcardPromptBuilder()
        self.flashcard_validator = FlashcardOutputValidator()
        self.token_budget = RequestTokenBudget()

    def start(self, job_id):
        job = DocumentAIJob.objects.select_related("document").get(id=job_id)
        document = job.document
        DocumentSummaryService().validate_document_ready(document)
        chunking = DocumentChunker().chunk(
            document.extracted_text,
            page_map=(document.metadata or {}).get("extraction", {}).get("page_map", []),
        )
        if not chunking.chunks:
            self.fail_job(job, "NO_EXTRACTABLE_TEXT", "This document does not contain extractable text.")
            return progress_payload(job)
        with transaction.atomic():
            job = DocumentAIJob.objects.select_for_update().get(id=job_id)
            if job.status == DocumentAIJob.Status.COMPLETED:
                return progress_payload(job)
            DocumentAIChunk.objects.filter(job=job).delete()
            DocumentAIChunk.objects.bulk_create(
                [
                    DocumentAIChunk(
                        job=job,
                        chunk_index=chunk.index,
                        text=chunk.text,
                        metadata=chunk.metadata(),
                    )
                    for chunk in chunking.chunks
                ]
            )
            summary, _ = DocumentSummary.objects.get_or_create(
                document=job.document,
                mode=self.summary_mode,
                defaults={
                    "status": DocumentSummary.Status.PENDING,
                    "input_checksum": job.source_checksum,
                    "prompt_version": SUMMARY_PROMPT_VERSION,
                },
            )
            source = DocumentSourceSelector().select(
                job.document,
                {"scope": "full_document", "quantity": 10, "difficulty": FlashcardDeck.Difficulty.MEDIUM},
            )
            fingerprint = FlashcardGenerationService().generation_fingerprint(
                job.document,
                source,
                {"scope": "full_document", "quantity": 10, "difficulty": FlashcardDeck.Difficulty.MEDIUM},
            )
            deck, _ = FlashcardDeck.objects.get_or_create(
                user=job.user,
                document=job.document,
                generation_fingerprint=fingerprint,
                defaults={
                    "title": f"{job.document.original_name} review",
                    "difficulty": FlashcardDeck.Difficulty.MEDIUM,
                    "requested_quantity": 10,
                    "quantity": 0,
                    "generated_quantity": 0,
                    "status": FlashcardDeck.Status.PENDING,
                    "scope": source.scope,
                    "source_checksum": source.source_checksum,
                    "prompt_version": FLASHCARD_PROMPT_VERSION,
                    "source_character_count": source.source_character_count,
                    "source_truncated": source.source_truncated,
                },
            )
            job.status = DocumentAIJob.Status.PROCESSING_CHUNKS
            job.current_operation = "chunk_analysis"
            job.total_chunks = len(chunking.chunks)
            job.completed_chunks = 0
            job.summary = summary
            job.flashcard_deck = deck
            job.summary_status = summary.status
            job.flashcard_status = deck.status
            job.started_at = job.started_at or timezone.now()
            job.save()
        from apps.ai.tasks import process_next_document_chunk

        process_next_document_chunk.delay(str(job.id))
        return progress_payload(job)

    def process_next_chunk(self, job_id):
        from apps.ai.tasks import generate_document_short_summary, process_next_document_chunk

        job = claim_ai_slot_or_reschedule(job_id, process_next_document_chunk, str(job_id))
        if job is None:
            return {"status": "rescheduled"}
        with transaction.atomic():
            job = DocumentAIJob.objects.select_for_update().get(id=job_id)
            chunk = (
                DocumentAIChunk.objects.select_for_update()
                .filter(job=job, status__in=[DocumentAIChunk.Status.PENDING, DocumentAIChunk.Status.RETRY_SCHEDULED])
                .order_by("chunk_index")
                .first()
            )
            if chunk is None:
                job.status = DocumentAIJob.Status.GENERATING_SUMMARY
                job.current_operation = "summary"
                job.save(update_fields=["status", "current_operation", "updated_at"])
                transaction.on_commit(lambda: generate_document_short_summary.delay(str(job.id)))
                return progress_payload(job)
            chunk.status = DocumentAIChunk.Status.PROCESSING
            chunk.attempt_count += 1
            chunk.error_code = ""
            chunk.error_message = ""
            chunk.save()
            job.status = DocumentAIJob.Status.PROCESSING_CHUNKS
            job.current_operation = "chunk_analysis"
            job.current_chunk_index = chunk.chunk_index
            job.attempt_count += 1
            job.save()
        try:
            result, usage_id = self.call_chunk(job, chunk)
        except AIServiceError as exc:
            return self.handle_retryable_chunk_error(job_id, chunk.id, exc)
        with transaction.atomic():
            job = DocumentAIJob.objects.select_for_update().get(id=job_id)
            chunk = DocumentAIChunk.objects.select_for_update().get(id=chunk.id)
            context = RollingDocumentContext()
            context.summary = job.rolling_context_summary
            context.entity_memory = job.entity_memory_json or {}
            context.open_context = job.open_context_json or []
            context.context_updates = (job.chunk_summaries_json or [])[-10:]
            doc_chunk = self.document_chunk_from_record(chunk)
            context.apply(doc_chunk, result)
            chunk.status = DocumentAIChunk.Status.COMPLETED
            chunk.partial_result = result
            chunk.updated_context_summary = context.summary
            chunk.provider_request_usage_id = usage_id
            chunk.processed_at = timezone.now()
            chunk.save()
            job.rolling_context_summary = context.summary
            job.entity_memory_json = context.entity_memory
            job.open_context_json = context.open_context
            summaries = list(job.chunk_summaries_json or [])
            summaries.append(
                {
                    "chunk": chunk.chunk_index,
                    "metadata": chunk.metadata,
                    "summary": result.get("structured_summary", {}),
                    "partial_summary": result.get("partial_summary", ""),
                    "key_points": result.get("key_points", []),
                    "context_updates": result.get("context_updates", []),
                }
            )
            job.chunk_summaries_json = summaries
            job.flashcard_candidates_json = list(job.flashcard_candidates_json or []) + result.get("flashcard_candidates", [])
            job.completed_chunks = DocumentAIChunk.objects.filter(job=job, status=DocumentAIChunk.Status.COMPLETED).count()
            job.save()
            next_exists = DocumentAIChunk.objects.filter(
                job=job,
                status__in=[DocumentAIChunk.Status.PENDING, DocumentAIChunk.Status.RETRY_SCHEDULED],
            ).exists()
        if next_exists:
            process_next_document_chunk.delay(str(job_id))
        else:
            generate_document_short_summary.delay(str(job_id))
        return progress_payload(job)

    def call_chunk(self, job, chunk):
        document = StudyDocument.objects.get(id=job.document_id)
        doc_chunk = self.document_chunk_from_record(chunk)
        system_prompt, user_prompt = self.summary_builder.build_contextual_chunk_messages(
            self.summary_mode,
            doc_chunk,
            rolling_context=job.rolling_context_summary,
            entity_memory=job.entity_memory_json,
            open_context=job.open_context_json,
            document=document,
        )
        user_prompt = self.token_budget.enforce(system_prompt, user_prompt, CHUNK_RESERVED_OUTPUT_TOKENS)
        request = PreparedAIRequest(
            operation="document_summary",
            model=settings.DOCUMENT_SUMMARY_MODEL or settings.OPENROUTER_MODEL,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            response_format={"type": "json_object"},
            max_completion_tokens=CHUNK_RESERVED_OUTPUT_TOKENS,
            prompt_version=SUMMARY_PROMPT_VERSION,
            job_id=str(job.id),
            document_id=job.document_id,
            chunk_id=str(chunk.chunk_index),
        )
        response = AIClient(model=request.model, max_retries=0).complete_prepared(request)
        return self.context_validator.parse_and_validate(response["content"], self.summary_mode, chunk.chunk_index), response.get("request_usage_id")

    def generate_summary(self, job_id):
        from apps.ai.tasks import generate_document_ai_flashcards, generate_document_short_summary

        job = DocumentAIJob.objects.select_related("summary").get(id=job_id)
        if job.summary and job.summary.status == DocumentSummary.Status.COMPLETED:
            generate_document_ai_flashcards.delay(str(job_id))
            return progress_payload(job)
        job = claim_ai_slot_or_reschedule(job_id, generate_document_short_summary, str(job_id))
        if job is None:
            return {"status": "rescheduled"}
        source = json.dumps(
            {
                "rolling_context_summary": job.rolling_context_summary,
                "chunk_summaries": job.chunk_summaries_json,
            },
            ensure_ascii=False,
        )
        system_prompt, user_prompt = self.summary_builder.build_messages(self.summary_mode, source, phase="final")
        reserved_output_tokens = reserved_output_tokens_for(self.summary_mode, "final")
        user_prompt = self.token_budget.enforce(system_prompt, user_prompt, reserved_output_tokens)
        request = PreparedAIRequest(
            operation="document_summary",
            model=settings.DOCUMENT_SUMMARY_MODEL or settings.OPENROUTER_MODEL,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            response_format={"type": "json_object"},
            max_completion_tokens=reserved_output_tokens,
            prompt_version=SUMMARY_PROMPT_VERSION,
            job_id=str(job.id),
            document_id=job.document_id,
        )
        try:
            response = AIClient(model=request.model, max_retries=0).complete_prepared(request)
            structured = self.summary_validator.parse_and_validate(response["content"], self.summary_mode)
        except AIServiceError as exc:
            return self.handle_retryable_job_error(job_id, exc, generate_document_short_summary)
        with transaction.atomic():
            job = DocumentAIJob.objects.select_for_update().select_related("summary").get(id=job_id)
            summary = job.summary
            summary.structured_content = structured
            summary.structured_content["processing_context"] = {
                "rolling_context_summary": job.rolling_context_summary,
                "chunks": job.chunk_summaries_json,
            }
            summary.content = self.summary_validator.render_markdown(structured, self.summary_mode)
            summary.status = DocumentSummary.Status.COMPLETED
            summary.provider = response.get("source") or settings.AI_PROVIDER
            summary.model_name = request.model
            summary.source = "ai"
            summary.prompt_version = SUMMARY_PROMPT_VERSION
            summary.input_checksum = job.source_checksum
            summary.generated_at = timezone.now()
            summary.save()
            job.summary_status = DocumentSummary.Status.COMPLETED
            job.status = DocumentAIJob.Status.GENERATING_FLASHCARDS
            job.current_operation = "flashcards"
            job.save()
        generate_document_ai_flashcards.delay(str(job_id))
        return progress_payload(job)

    def generate_flashcards(self, job_id):
        from apps.ai.tasks import finalize_document_ai_job, generate_document_ai_flashcards

        job = DocumentAIJob.objects.select_related("flashcard_deck").get(id=job_id)
        if job.flashcard_deck and job.flashcard_deck.status == FlashcardDeck.Status.COMPLETED and job.flashcard_deck.cards.count() == 10:
            finalize_document_ai_job.delay(str(job_id))
            return progress_payload(job)
        job = claim_ai_slot_or_reschedule(job_id, generate_document_ai_flashcards, str(job_id))
        if job is None:
            return {"status": "rescheduled"}
        source_text = "\n\n".join(
            [
                job.rolling_context_summary,
                json.dumps(job.chunk_summaries_json, ensure_ascii=False),
            ]
        ).strip()
        system_prompt, user_prompt = self.flashcard_builder.build_messages(
            source_text,
            difficulty=FlashcardDeck.Difficulty.MEDIUM,
            quantity=10,
            scope_metadata={"type": "full_document", "job_id": str(job.id)},
            existing_questions=[],
        )
        user_prompt = self.token_budget.enforce(system_prompt, user_prompt, FLASHCARD_RESERVED_OUTPUT_TOKENS)
        request = PreparedAIRequest(
            operation="flashcard_generation",
            model=settings.FLASHCARD_GENERATION_MODEL or settings.OPENROUTER_MODEL,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            response_format={"type": "json_object"},
            max_completion_tokens=FLASHCARD_RESERVED_OUTPUT_TOKENS,
            prompt_version=FLASHCARD_PROMPT_VERSION,
            job_id=str(job.id),
            document_id=job.document_id,
        )
        try:
            response = AIClient(model=request.model, max_retries=0).complete_prepared(request)
            cards = FlashcardGenerationService().dedupe(
                self.flashcard_validator.parse_and_validate(response["content"], 10, FlashcardDeck.Difficulty.MEDIUM, source_text),
                10,
            )
            if len(cards) < 10:
                raise AIInvalidResponse("AI returned fewer than 10 usable flashcards.")
        except AIServiceError as exc:
            return self.handle_retryable_job_error(job_id, exc, generate_document_ai_flashcards)
        with transaction.atomic():
            job = DocumentAIJob.objects.select_for_update().select_related("flashcard_deck", "document").get(id=job_id)
            deck = job.flashcard_deck
            deck.cards.all().delete()
            Flashcard.objects.bulk_create(
                [
                    Flashcard(
                        deck=deck,
                        document=job.document,
                        question=card["question"],
                        answer=card["answer"],
                        difficulty=FlashcardDeck.Difficulty.MEDIUM,
                        page_reference=f"chunk {card.get('source_chunk_index', '')}".strip(),
                        order=index,
                    )
                    for index, card in enumerate(cards[:10])
                ]
            )
            deck.status = FlashcardDeck.Status.COMPLETED
            deck.quantity = 10
            deck.generated_quantity = 10
            deck.error_code = ""
            deck.error_message = ""
            deck.provider = response.get("source") or settings.AI_PROVIDER
            deck.model_name = request.model
            deck.save()
            job.flashcard_status = FlashcardDeck.Status.COMPLETED
            job.status = DocumentAIJob.Status.FINALIZING
            job.current_operation = "finalize"
            job.save()
        finalize_document_ai_job.delay(str(job_id))
        return progress_payload(job)

    def finalize(self, job_id):
        from apps.notifications.models import Notification
        from apps.notifications.services import NotificationService

        with transaction.atomic():
            job = (
                DocumentAIJob.objects.select_for_update(of=("self",))
                .select_related("document", "summary", "flashcard_deck", "user")
                .get(id=job_id)
            )
            if job.status == DocumentAIJob.Status.COMPLETED:
                return progress_payload(job)
            if not (
                job.summary
                and job.summary.status == DocumentSummary.Status.COMPLETED
                and job.flashcard_deck
                and job.flashcard_deck.status == FlashcardDeck.Status.COMPLETED
                and job.flashcard_deck.cards.count() == 10
            ):
                return progress_payload(job)
            job.status = DocumentAIJob.Status.COMPLETED
            job.current_operation = "completed"
            job.completed_at = timezone.now()
            job.error_code = ""
            job.error_message = ""
            job.save()
        NotificationService().create_once(
            user=job.user,
            notification_type=Notification.Type.DOCUMENT_AI_COMPLETED,
            title="Tài liệu đã sẵn sàng",
            message=f'Tài liệu "{job.document.original_name}" đã được xử lý xong. Bản tóm tắt và 10 flashcard đã sẵn sàng.',
            dedupe_key=f"document-ai-completed:{job.id}",
            metadata={"document_id": str(job.document_id), "job_id": str(job.id)},
        )
        DocumentAIJob.objects.filter(id=job.id).update(
            notification_status=DocumentAIJob.NotificationStatus.SENT,
            updated_at=timezone.now(),
        )
        job.notification_status = DocumentAIJob.NotificationStatus.SENT
        return progress_payload(job)

    def handle_retryable_chunk_error(self, job_id, chunk_id, exc):
        from apps.ai.tasks import process_next_document_chunk

        with transaction.atomic():
            job = DocumentAIJob.objects.select_for_update().get(id=job_id)
            chunk = DocumentAIChunk.objects.select_for_update().get(id=chunk_id)
            if isinstance(exc, AIAuthError) or getattr(exc, "error_code", "") == "AI_TOKEN_BUDGET_EXCEEDED":
                chunk.status = DocumentAIChunk.Status.FAILED
                chunk.error_code = exc.error_code
                chunk.error_message = exc.safe_message
                chunk.save()
                self.fail_job(job, exc.error_code, exc.safe_message)
                return progress_payload(job)
            if chunk.attempt_count >= settings.DOCUMENT_SUMMARY_TASK_MAX_RETRIES + 1:
                chunk.status = DocumentAIChunk.Status.FAILED
                chunk.error_code = exc.error_code
                chunk.error_message = exc.safe_message
                chunk.save()
                self.fail_job(job, exc.error_code, exc.safe_message)
                return progress_payload(job)
            chunk.status = DocumentAIChunk.Status.RETRY_SCHEDULED
            chunk.error_code = exc.error_code
            chunk.error_message = exc.safe_message
            chunk.save()
            delay = retry_delay(job, exc)
            transaction.on_commit(lambda: process_next_document_chunk.apply_async(args=[str(job.id)], countdown=delay))
            return progress_payload(job)

    def handle_retryable_job_error(self, job_id, exc, task):
        with transaction.atomic():
            job = DocumentAIJob.objects.select_for_update().get(id=job_id)
            job.attempt_count += 1
            if isinstance(exc, AIAuthError) or getattr(exc, "error_code", "") == "AI_TOKEN_BUDGET_EXCEEDED":
                self.fail_job(job, exc.error_code, exc.safe_message)
                return progress_payload(job)
            if job.attempt_count > max(settings.DOCUMENT_SUMMARY_TASK_MAX_RETRIES, settings.FLASHCARD_GENERATION_TASK_MAX_RETRIES):
                self.fail_job(job, exc.error_code, exc.safe_message)
                return progress_payload(job)
            delay = retry_delay(job, exc)
            transaction.on_commit(lambda: task.apply_async(args=[str(job.id)], countdown=delay))
            return progress_payload(job)

    def fail_job(self, job, code, message):
        job.status = DocumentAIJob.Status.FAILED
        job.error_code = code
        job.error_message = message
        job.completed_at = timezone.now()
        job.save()

    def document_chunk_from_record(self, record):
        metadata = record.metadata or {}
        chunk = DocumentChunk(record.chunk_index, record.text, 0, len(record.text))
        for key, value in metadata.items():
            if hasattr(chunk, key):
                setattr(chunk, key, value)
        return chunk

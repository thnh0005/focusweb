import hashlib
import json
import re
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status as http_status

from apps.ai.models import Flashcard, FlashcardDeck, StudyDocument
from apps.ai.services.ai_client import AIClient
from apps.ai.services.document_summary import DocumentChunker
from apps.ai.services.document_summary import FLASHCARD_RESERVED_OUTPUT_TOKENS, RequestTokenBudget
from apps.ai.services.exceptions import (
    AIInvalidResponse,
    AINotConfigured,
    AIProviderError,
    AIProviderUnavailable,
    AIQuotaDeferred,
    AIRateLimited,
    AIServiceError,
    AITimeout,
)
from apps.ai.services.observability import log_ai_event
from apps.ai.services.prompt_builder import FlashcardPromptBuilder


ERROR_EXTRACTION_NOT_READY = "EXTRACTION_NOT_READY"
ERROR_EXTRACTION_FAILED = "EXTRACTION_FAILED"
ERROR_NO_EXTRACTABLE_TEXT = "NO_EXTRACTABLE_TEXT"
ERROR_INVALID_SCOPE = "INVALID_FLASHCARD_SCOPE"
ERROR_INVALID_PAGE_RANGE = "INVALID_PAGE_RANGE"
ERROR_INVALID_SECTION_RANGE = "INVALID_SECTION_RANGE"
ERROR_PAGE_RANGE_NOT_SUPPORTED = "PAGE_RANGE_NOT_SUPPORTED"
ERROR_SECTION_RANGE_NOT_SUPPORTED = "SECTION_RANGE_NOT_SUPPORTED"
ERROR_INVALID_AI_OUTPUT = "INVALID_AI_OUTPUT"
ERROR_INSUFFICIENT_AI_OUTPUT = "INSUFFICIENT_AI_OUTPUT"
ERROR_UNGROUNDED_AI_OUTPUT = "UNGROUNDED_AI_OUTPUT"
ERROR_GENERATION_FAILED = "FLASHCARD_GENERATION_FAILED"
PROMPT_VERSION = FlashcardPromptBuilder.PROMPT_VERSION


class FlashcardGenerationError(Exception):
    def __init__(self, code, message, status_code=http_status.HTTP_400_BAD_REQUEST):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code

    def response_data(self):
        return {"error": {"code": self.code, "message": self.message}}


@dataclass
class SourceSelection:
    text: str
    scope: dict
    source_checksum: str
    source_character_count: int
    document_id: str = ""
    source_truncated: bool = False


@dataclass
class GenerationRequestResult:
    deck: FlashcardDeck
    cached: bool
    should_enqueue: bool
    created: bool
    reused: bool = False


class DocumentSourceSelector:
    def select(self, document, config):
        text = document.extracted_text or ""
        scope = config["scope"]
        if scope == "full_document":
            scope_metadata = {"type": "full_document"}
            return self.result(document, text.strip(), scope_metadata)
        if scope == "page_range":
            return self.select_page_range(
                document,
                config["page_start"],
                config["page_end"],
                text,
            )
        if scope == "section":
            return self.select_section(
                document,
                config["section_start"],
                config["section_end"],
                text,
            )
        raise FlashcardGenerationError(
            ERROR_INVALID_SCOPE,
            "Invalid flashcard generation scope.",
        )

    def select_page_range(self, document, page_start, page_end, text):
        if page_start < 1 or page_end < page_start:
            raise FlashcardGenerationError(
                ERROR_INVALID_PAGE_RANGE,
                "Invalid page range.",
            )
        if document.page_count and page_end > document.page_count:
            raise FlashcardGenerationError(
                ERROR_INVALID_PAGE_RANGE,
                "Page range exceeds document page count.",
            )
        page_map = (document.metadata or {}).get("extraction", {}).get("page_map", [])
        pages = [
            item
            for item in page_map
            if item.get("page") is not None and page_start <= int(item["page"]) <= page_end
        ]
        if not pages:
            raise FlashcardGenerationError(
                ERROR_PAGE_RANGE_NOT_SUPPORTED,
                "Page range is not supported for this document.",
            )
        start = min(int(item.get("start_char", 0)) for item in pages)
        end = max(int(item.get("end_char", start)) for item in pages)
        selected = text[start:end].strip()
        return self.result(
            document,
            selected,
            {"type": "page_range", "page_start": page_start, "page_end": page_end},
        )

    def select_section(self, document, section_start, section_end, text):
        if section_start < 1 or section_end < section_start:
            raise FlashcardGenerationError(
                ERROR_INVALID_SECTION_RANGE,
                "Invalid section range.",
            )
        section_map = (document.metadata or {}).get("extraction", {}).get("section_map", [])
        sections = [
            item
            for item in section_map
            if item.get("section") is not None
            and section_start <= int(item["section"]) <= section_end
        ]
        if not sections:
            raise FlashcardGenerationError(
                ERROR_SECTION_RANGE_NOT_SUPPORTED,
                "Section range is not supported for this document.",
            )
        start = min(int(item.get("start_char", 0)) for item in sections)
        end = max(int(item.get("end_char", start)) for item in sections)
        selected = text[start:end].strip()
        return self.result(
            document,
            selected,
            {
                "type": "section",
                "section_start": section_start,
                "section_end": section_end,
            },
        )

    def result(self, document, selected_text, scope):
        if not selected_text.strip():
            raise FlashcardGenerationError(
                ERROR_NO_EXTRACTABLE_TEXT,
                "This document does not contain extractable text for this scope.",
                http_status.HTTP_409_CONFLICT,
            )
        extraction_checksum = FlashcardGenerationService.current_checksum(document)
        source_hash = hashlib.sha256(
            json.dumps(
                {
                    "document_checksum": extraction_checksum,
                    "scope": scope,
                    "text_hash": hashlib.sha256(selected_text.encode("utf-8")).hexdigest(),
                },
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()
        return SourceSelection(
            text=selected_text,
            scope=scope,
            source_checksum=source_hash,
            source_character_count=len(selected_text),
            document_id=str(document.id),
            source_truncated=False,
        )


class FlashcardOutputValidator:
    QUESTION_LIMIT = 500
    ANSWER_LIMIT = 5000

    def parse_and_validate(self, content, quantity, difficulty, source_text):
        try:
            parsed = json.loads(self.extract_json(content))
        except (TypeError, json.JSONDecodeError) as exc:
            raise AIInvalidResponse("Flashcard JSON was invalid.") from exc
        if not isinstance(parsed, dict) or not isinstance(parsed.get("flashcards"), list):
            raise AIInvalidResponse("Flashcard output must include a flashcards list.")

        cleaned = []
        seen = set()
        for item in parsed["flashcards"]:
            if not isinstance(item, dict):
                continue
            question = self.clean_text(item.get("question"), self.QUESTION_LIMIT)
            answer = self.clean_text(item.get("answer"), self.ANSWER_LIMIT)
            if not question or not answer:
                continue
            if self.normalize_key(question) == self.normalize_key(answer):
                continue
            key = (self.normalize_key(question), self.normalize_key(answer))
            question_key = self.normalize_key(question)
            if key in seen or question_key in seen:
                continue
            if not self.is_grounded(question, answer, source_text):
                continue
            seen.add(key)
            seen.add(question_key)
            cleaned.append(
                {
                    "question": question,
                    "answer": answer,
                    "difficulty": difficulty,
                }
            )
            if len(cleaned) >= quantity:
                break
        if not cleaned:
            raise AIInvalidResponse("Flashcard output had no valid cards.")
        return cleaned

    def extract_json(self, content):
        text = str(content or "").strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        return text

    def clean_text(self, value, limit):
        text = str(value or "").strip()
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"\s+", " ", text)
        return text[:limit].strip()

    def normalize_key(self, value):
        text = str(value or "").strip().lower()
        text = re.sub(r"\s+", " ", text)
        return text.rstrip("?.!。！？").strip()

    def is_grounded(self, question, answer, source_text):
        source_words = self.keywords(source_text)
        output_words = self.keywords(f"{question} {answer}")
        if not output_words:
            return False
        overlap = source_words.intersection(output_words)
        return bool(overlap) or len(output_words) <= 3

    def keywords(self, text):
        return {
            token.lower()
            for token in re.findall(r"[\wÀ-ỹ]+", text or "", flags=re.UNICODE)
            if len(token) >= 4
        }


class FlashcardGenerationService:
    def __init__(self, client=None, selector=None, chunker=None, prompt_builder=None, validator=None):
        self.client = client or AIClient(model=settings.FLASHCARD_GENERATION_MODEL, max_retries=0)
        self.selector = selector or DocumentSourceSelector()
        self.chunker = chunker or DocumentChunker(
            chunk_characters=settings.FLASHCARD_GENERATION_CHUNK_CHARACTERS,
            max_chunks=settings.FLASHCARD_GENERATION_MAX_CHUNKS,
        )
        self.prompt_builder = prompt_builder or FlashcardPromptBuilder()
        self.validator = validator or FlashcardOutputValidator()
        self.token_budget = RequestTokenBudget()
        self.chunk_request_delay_seconds = getattr(settings, "DOCUMENT_CHUNK_REQUEST_DELAY_SECONDS", 60)

    def normalize_config(self, data):
        return {
            "scope": data["scope"],
            "page_start": data.get("page_start"),
            "page_end": data.get("page_end"),
            "section_start": data.get("section_start"),
            "section_end": data.get("section_end"),
            "quantity": int(data["quantity"]),
            "difficulty": data["difficulty"],
            "force": bool(data.get("force", False)),
        }

    def request_generation(self, document, config, force=False):
        self.validate_document_ready(document)
        source = self.selector.select(document, config)
        fingerprint = self.generation_fingerprint(document, source, config)
        self.mark_stale_decks(document, source, config, fingerprint)

        with transaction.atomic():
            deck = (
                FlashcardDeck.objects.select_for_update()
                .filter(
                    user=document.user,
                    document=document,
                    generation_fingerprint=fingerprint,
                )
                .order_by("-generated_at")
                .first()
            )
            if deck:
                if deck.status in {FlashcardDeck.Status.PENDING, FlashcardDeck.Status.PROCESSING}:
                    log_ai_event(
                        "flashcard_generation_event",
                        action="deck_reused_pending",
                        deck_id=str(deck.id),
                        document_id=str(document.id),
                        generation_fingerprint=fingerprint,
                        status=deck.status,
                    )
                    return GenerationRequestResult(
                        deck,
                        cached=False,
                        should_enqueue=False,
                        created=False,
                        reused=True,
                    )
                if (
                    not force
                    and deck.status in {FlashcardDeck.Status.COMPLETED, FlashcardDeck.Status.PARTIAL}
                ):
                    return GenerationRequestResult(deck, cached=True, should_enqueue=False, created=False)
                deck.cards.all().delete()
                self.prepare_deck(deck, document, source, config, fingerprint)
                return GenerationRequestResult(deck, cached=False, should_enqueue=True, created=False)

            try:
                with transaction.atomic():
                    deck = FlashcardDeck.objects.create(
                        user=document.user,
                        document=document,
                        title=self.deck_title(document, config),
                        difficulty=config["difficulty"],
                        requested_quantity=config["quantity"],
                        quantity=0,
                        generated_quantity=0,
                        status=FlashcardDeck.Status.PENDING,
                        scope=source.scope,
                        page_range=self.page_range_for_scope(source.scope),
                        source_checksum=source.source_checksum,
                        generation_fingerprint=fingerprint,
                        prompt_version=PROMPT_VERSION,
                        source_character_count=source.source_character_count,
                        source_truncated=source.source_truncated,
                    )
            except IntegrityError:
                deck = FlashcardDeck.objects.select_for_update().get(generation_fingerprint=fingerprint)
                return GenerationRequestResult(deck, cached=False, should_enqueue=False, created=False, reused=True)
            return GenerationRequestResult(deck, cached=False, should_enqueue=True, created=True)

    def generate(self, document_id, config, force=False):
        document = StudyDocument.objects.get(pk=document_id)
        config = self.normalize_config(config)
        request = self.request_generation(document, config, force=force)
        if request.cached and not force:
            return self.task_result(request.deck, cached=True)
        deck = self.claim_deck_for_generation(request.deck.id, force=force)
        if deck is None:
            latest = FlashcardDeck.objects.prefetch_related("cards").get(id=request.deck.id)
            return self.task_result(latest, cached=False)
        source = self.selector.select(document, config)
        chunks = self.chunker.chunk(source.text).chunks
        if not chunks:
            self.fail_deck(deck, ERROR_NO_EXTRACTABLE_TEXT, "No extractable text.")
            raise FlashcardGenerationError(
                ERROR_NO_EXTRACTABLE_TEXT,
                "This document does not contain extractable text.",
                http_status.HTTP_409_CONFLICT,
            )

        self.mark_processing(deck, source, len(chunks))
        try:
            cards = self.generate_cards(deck, source, chunks, config)
        except AIQuotaDeferred as exc:
            self.defer_deck(deck, exc)
            raise
        except AIServiceError as exc:
            self.fail_deck(deck, self.map_ai_error(exc), exc.safe_message)
            raise
        except Exception:
            self.fail_deck(deck, ERROR_GENERATION_FAILED, "Flashcard generation failed.")
            raise

        status_value = (
            FlashcardDeck.Status.COMPLETED
            if len(cards) >= config["quantity"]
            else FlashcardDeck.Status.PARTIAL
        )
        with transaction.atomic():
            deck.cards.all().delete()
            Flashcard.objects.bulk_create(
                [
                    Flashcard(
                        deck=deck,
                        document=document,
                        question=card["question"],
                        answer=card["answer"],
                        difficulty=config["difficulty"],
                        page_reference=self.page_reference(source.scope),
                        order=index,
                    )
                    for index, card in enumerate(cards[: config["quantity"]])
                ]
            )
            deck.status = status_value
            deck.quantity = min(len(cards), config["quantity"])
            deck.generated_quantity = deck.quantity
            deck.error_code = "" if status_value == FlashcardDeck.Status.COMPLETED else ERROR_INSUFFICIENT_AI_OUTPUT
            deck.error_message = "" if status_value == FlashcardDeck.Status.COMPLETED else "AI returned fewer valid flashcards than requested."
            deck.generated_at = timezone.now()
            deck.scope = self.scope_without_processing_context(deck.scope)
            deck.save(
                update_fields=[
                    "status",
                    "quantity",
                    "generated_quantity",
                    "error_code",
                    "error_message",
                    "generated_at",
                    "scope",
                    "updated_at",
                ]
            )
            log_ai_event(
                "flashcard_generation_event",
                action="cards_persisted",
                deck_id=str(deck.id),
                document_id=str(document.id),
                generation_fingerprint=deck.generation_fingerprint,
                status=status_value,
                requested_quantity=config["quantity"],
                generated_quantity=deck.quantity,
            )
        return self.task_result(deck, cached=False)

    def generate_cards(self, deck, source, chunks, config):
        allocations = self.allocate_quantity(config["quantity"], chunks)
        checkpoint = self.restore_checkpoint(deck, source, config)
        cards = self.dedupe(list(checkpoint.get("candidate_cards") or []), config["quantity"])
        chunk_results = dict(checkpoint.get("chunk_results") or {})
        completed_chunk_ids = {str(value) for value in checkpoint.get("completed_chunk_ids") or []}
        fill_completed = bool(checkpoint.get("fill_completed"))
        active_chunks = [(chunk, amount) for chunk, amount in zip(chunks, allocations) if amount > 0]
        for position, (chunk, amount) in enumerate(active_chunks):
            if amount <= 0:
                continue
            chunk_key = str(position + 1)
            if chunk_key in completed_chunk_ids:
                log_ai_event(
                    "flashcard_generation_event",
                    action="chunk_resume_skip",
                    deck_id=str(deck.id),
                    document_id=source.document_id,
                    generation_fingerprint=deck.generation_fingerprint,
                    chunk_index=position + 1,
                    chunk_id=chunk_key,
                    completed_chunk_ids=sorted(completed_chunk_ids),
                )
                continue
            payload_hash = hashlib.sha256(chunk.text.encode("utf-8")).hexdigest()
            log_ai_event(
                "flashcard_generation_event",
                action="chunk_request_start",
                deck_id=str(deck.id),
                document_id=source.document_id,
                generation_fingerprint=deck.generation_fingerprint,
                chunk_index=position + 1,
                chunk_id=chunk_key,
                payload_hash=payload_hash,
                requested_quantity=amount,
            )
            cards.extend(
                self.call_and_validate(
                    chunk.text,
                    amount,
                    config["difficulty"],
                    {**source.scope, "chunk": chunk.metadata(), "previous_chunk_tail": chunk.previous_tail},
                    existing_questions=[card["question"] for card in cards],
                    document_id=source.document_id,
                    chunk_id=chunk_key,
                )
            )
            cards = self.dedupe(cards, config["quantity"])
            chunk_results[chunk_key] = cards
            completed_chunk_ids.add(chunk_key)
            self.save_checkpoint(
                deck,
                source,
                config,
                cards,
                chunk_results,
                completed_chunk_ids,
                last_completed_chunk_index=position + 1,
                fill_completed=fill_completed,
            )
        if len(cards) < config["quantity"]:
            missing = config["quantity"] - len(cards)
            if not fill_completed:
                cards.extend(
                    self.call_and_validate(
                        source.text,
                        missing,
                        config["difficulty"],
                        {**source.scope, "fill_pass": True},
                        existing_questions=[card["question"] for card in cards],
                        document_id=source.document_id,
                        chunk_id="fill",
                    )
                )
                cards = self.dedupe(cards, config["quantity"])
                fill_completed = True
                self.save_checkpoint(
                    deck,
                    source,
                    config,
                    cards,
                    chunk_results,
                    completed_chunk_ids,
                    last_completed_chunk_index=max([0, *[int(value) for value in completed_chunk_ids if value.isdigit()]]),
                    fill_completed=fill_completed,
                )
        return self.dedupe(cards, config["quantity"])

    def call_and_validate(self, source_text, quantity, difficulty, scope_metadata, existing_questions, document_id="", chunk_id=""):
        system_prompt, user_prompt = self.prompt_builder.build_messages(
            source_text,
            difficulty=difficulty,
            quantity=quantity,
            scope_metadata=scope_metadata,
            existing_questions=existing_questions,
        )
        user_prompt = self.token_budget.enforce(
            system_prompt,
            user_prompt,
            FLASHCARD_RESERVED_OUTPUT_TOKENS,
        )
        response = self.client.complete_json(
            system_prompt,
            user_prompt,
            operation="flashcard_generation",
            prompt_version=PROMPT_VERSION,
            max_completion_tokens=FLASHCARD_RESERVED_OUTPUT_TOKENS,
            document_id=document_id or None,
            chunk_id=chunk_id,
        )
        return self.validator.parse_and_validate(
            response["content"],
            quantity,
            difficulty,
            source_text,
        )

    def allocate_quantity(self, quantity, chunks):
        if len(chunks) == 1:
            return [quantity]
        lengths = [max(1, len(chunk.text)) for chunk in chunks]
        total = sum(lengths)
        allocations = [max(1, round(quantity * length / total)) for length in lengths]
        while sum(allocations) > quantity:
            index = allocations.index(max(allocations))
            allocations[index] -= 1
        while sum(allocations) < quantity:
            index = lengths.index(max(lengths))
            allocations[index] += 1
        return allocations

    def dedupe(self, cards, quantity):
        cleaned = []
        seen = set()
        for card in cards:
            question_key = self.validator.normalize_key(card["question"])
            pair_key = (question_key, self.validator.normalize_key(card["answer"]))
            if question_key in seen or pair_key in seen:
                continue
            seen.add(question_key)
            seen.add(pair_key)
            cleaned.append(card)
            if len(cleaned) >= quantity:
                break
        return cleaned

    def restore_checkpoint(self, deck, source, config):
        context = (deck.scope or {}).get("processing_context") or {}
        if not context:
            return {}
        expected = {
            "source_checksum": source.source_checksum,
            "generation_fingerprint": deck.generation_fingerprint,
            "prompt_version": PROMPT_VERSION,
            "requested_quantity": config["quantity"],
            "difficulty": config["difficulty"],
            "source_scope": source.scope,
        }
        for key, value in expected.items():
            if context.get(key) != value:
                log_ai_event(
                    "flashcard_generation_event",
                    action="checkpoint_ignored",
                    deck_id=str(deck.id),
                    document_id=source.document_id,
                    generation_fingerprint=deck.generation_fingerprint,
                    status=deck.status,
                )
                return {}
        log_ai_event(
            "flashcard_generation_event",
            action="checkpoint_restored",
            deck_id=str(deck.id),
            document_id=source.document_id,
            generation_fingerprint=deck.generation_fingerprint,
            checkpoint_last_completed_chunk=context.get("last_completed_chunk_index", 0),
            completed_chunk_ids=context.get("completed_chunk_ids") or [],
            generated_quantity=len(context.get("candidate_cards") or []),
        )
        return context

    def save_checkpoint(
        self,
        deck,
        source,
        config,
        candidate_cards,
        chunk_results,
        completed_chunk_ids,
        last_completed_chunk_index=0,
        fill_completed=False,
        retry_after_seconds=None,
    ):
        retry_at = None
        if retry_after_seconds:
            retry_at = timezone.now() + timedelta(seconds=max(1, int(retry_after_seconds)))
        existing_context = (deck.scope or {}).get("processing_context") or {}
        context = {
            "checkpoint_version": 1,
            "source_checksum": source.source_checksum,
            "generation_fingerprint": deck.generation_fingerprint,
            "prompt_version": PROMPT_VERSION,
            "requested_quantity": config["quantity"],
            "difficulty": config["difficulty"],
            "source_scope": source.scope,
            "last_completed_chunk_index": int(last_completed_chunk_index or 0),
            "completed_chunk_ids": sorted(str(value) for value in completed_chunk_ids),
            "chunk_results": chunk_results,
            "candidate_cards": candidate_cards,
            "fill_completed": bool(fill_completed),
            "updated_at": timezone.now().isoformat(),
        }
        if existing_context.get("processing_started_at"):
            context["processing_started_at"] = existing_context["processing_started_at"]
        if retry_after_seconds:
            context["retry_after_seconds"] = max(1, int(retry_after_seconds))
            context["retry_at"] = retry_at.isoformat()

        scope = dict(deck.scope or {})
        scope["processing_context"] = context
        FlashcardDeck.objects.filter(pk=deck.pk).update(scope=scope, updated_at=timezone.now())
        deck.scope = scope
        log_ai_event(
            "flashcard_generation_event",
            action="checkpoint_saved",
            deck_id=str(deck.id),
            document_id=source.document_id,
            generation_fingerprint=deck.generation_fingerprint,
            checkpoint_last_completed_chunk=context["last_completed_chunk_index"],
            completed_chunk_ids=context["completed_chunk_ids"],
            requested_quantity=config["quantity"],
            generated_quantity=len(candidate_cards),
        )

    def scope_without_processing_context(self, scope):
        cleaned = dict(scope or {})
        cleaned.pop("processing_context", None)
        return cleaned

    def validate_document_ready(self, document):
        extraction = (document.metadata or {}).get("extraction", {})
        extraction_status = extraction.get("status", "")
        if document.status == StudyDocument.Status.ERROR or extraction_status == "failed":
            raise FlashcardGenerationError(
                ERROR_EXTRACTION_FAILED,
                "Document text could not be extracted.",
                http_status.HTTP_409_CONFLICT,
            )
        if document.status in {StudyDocument.Status.UPLOADED, StudyDocument.Status.PROCESSING}:
            raise FlashcardGenerationError(
                ERROR_EXTRACTION_NOT_READY,
                "Document text extraction is still in progress.",
                http_status.HTTP_409_CONFLICT,
            )
        if extraction_status in {"pending", "processing"}:
            raise FlashcardGenerationError(
                ERROR_EXTRACTION_NOT_READY,
                "Document text extraction is still in progress.",
                http_status.HTTP_409_CONFLICT,
            )
        if extraction_status == "empty" or not (document.extracted_text or "").strip():
            raise FlashcardGenerationError(
                ERROR_NO_EXTRACTABLE_TEXT,
                "This document does not contain extractable text.",
                http_status.HTTP_409_CONFLICT,
            )

    @staticmethod
    def current_checksum(document):
        extraction = (document.metadata or {}).get("extraction", {})
        checksum = extraction.get("checksum")
        if checksum:
            return checksum
        return hashlib.sha256((document.extracted_text or "").encode("utf-8")).hexdigest()

    def generation_fingerprint(self, document, source, config):
        return hashlib.sha256(
            json.dumps(
                {
                    "document_id": str(document.id),
                    "owner_id": str(document.user_id),
                    "source_checksum": source.source_checksum,
                    "scope": source.scope,
                    "quantity": config["quantity"],
                    "difficulty": config["difficulty"],
                    "prompt_version": PROMPT_VERSION,
                },
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()

    def mark_stale_decks(self, document, source, config, fingerprint):
        FlashcardDeck.objects.filter(
            document=document,
            difficulty=config["difficulty"],
            requested_quantity=config["quantity"],
        ).exclude(generation_fingerprint=fingerprint).filter(
            status__in=[FlashcardDeck.Status.COMPLETED, FlashcardDeck.Status.PARTIAL]
        ).update(status=FlashcardDeck.Status.STALE)

    def prepare_deck(self, deck, document, source, config, fingerprint):
        deck.title = self.deck_title(document, config)
        deck.difficulty = config["difficulty"]
        deck.requested_quantity = config["quantity"]
        deck.quantity = 0
        deck.generated_quantity = 0
        deck.status = FlashcardDeck.Status.PENDING
        deck.scope = source.scope
        deck.page_range = self.page_range_for_scope(source.scope)
        deck.source_checksum = source.source_checksum
        deck.generation_fingerprint = fingerprint
        deck.prompt_version = PROMPT_VERSION
        deck.source_character_count = source.source_character_count
        deck.source_truncated = source.source_truncated
        deck.error_code = ""
        deck.error_message = ""
        deck.save()

    def claim_deck_for_generation(self, deck_id, force=False):
        with transaction.atomic():
            deck = FlashcardDeck.objects.select_for_update().get(id=deck_id)
            if deck.status in {FlashcardDeck.Status.COMPLETED, FlashcardDeck.Status.PARTIAL} and not force:
                return None
            if deck.status == FlashcardDeck.Status.PROCESSING:
                log_ai_event(
                    "flashcard_generation_event",
                    action="task_duplicate_skipped",
                    deck_id=str(deck.id),
                    document_id=str(deck.document_id),
                    generation_fingerprint=deck.generation_fingerprint,
                    status=deck.status,
                )
                return None
            should_increment_attempt = deck.error_code != "AI_QUOTA_DEFERRED"
            deck.status = FlashcardDeck.Status.PROCESSING
            if should_increment_attempt:
                deck.generation_attempts += 1
            deck.error_code = ""
            deck.error_message = ""
            deck.save(update_fields=["status", "generation_attempts", "error_code", "error_message", "updated_at"])
            return deck

    def mark_processing(self, deck, source, chunk_count):
        deck.provider = getattr(self.client, "provider", "") or getattr(self.client, "PROVIDER", "openrouter")
        deck.model_name = getattr(self.client, "model", "") or settings.FLASHCARD_GENERATION_MODEL or settings.OPENROUTER_MODEL
        deck.source_character_count = source.source_character_count
        deck.source_truncated = source.source_truncated
        deck.error_code = ""
        deck.error_message = ""
        scope = dict(deck.scope or {})
        scope["chunk_count"] = chunk_count
        processing_context = dict(scope.get("processing_context") or {})
        processing_context.setdefault("processing_started_at", timezone.now().isoformat())
        scope["processing_context"] = processing_context
        deck.scope = scope
        deck.save(
            update_fields=[
                "provider",
                "model_name",
                "source_character_count",
                "source_truncated",
                "error_code",
                "error_message",
                "scope",
                "updated_at",
            ]
        )

    def defer_deck(self, deck, exc=None):
        scope = dict(deck.scope or {})
        context = dict(scope.get("processing_context") or {})
        if exc is not None:
            retry_after_seconds = max(1, int(getattr(exc, "retry_after_seconds", 1) or 1))
            context["retry_after_seconds"] = retry_after_seconds
            context["retry_at"] = (timezone.now() + timedelta(seconds=retry_after_seconds)).isoformat()
            context["updated_at"] = timezone.now().isoformat()
            scope["processing_context"] = context
        deck.status = FlashcardDeck.Status.PENDING
        deck.error_code = "AI_QUOTA_DEFERRED"
        deck.error_message = ""
        deck.scope = scope
        deck.save(update_fields=["status", "error_code", "error_message", "scope", "updated_at"])
        log_ai_event(
            "flashcard_generation_event",
            action="deck_deferred",
            deck_id=str(deck.id),
            document_id=str(deck.document_id),
            generation_fingerprint=deck.generation_fingerprint,
            retry_after_seconds=context.get("retry_after_seconds", 0),
        )

    def fail_deck(self, deck, code, message):
        deck.status = FlashcardDeck.Status.FAILED
        deck.error_code = code
        deck.error_message = str(message or "Flashcard generation failed.")[:500]
        deck.save(update_fields=["status", "error_code", "error_message", "updated_at"])

    def map_ai_error(self, exc):
        if isinstance(exc, AINotConfigured):
            return "AI_CONFIGURATION_ERROR"
        if isinstance(exc, AITimeout):
            return "AI_TIMEOUT"
        if isinstance(exc, AIRateLimited):
            return "AI_RATE_LIMITED"
        if isinstance(exc, AIProviderUnavailable):
            return "AI_PROVIDER_UNAVAILABLE"
        if isinstance(exc, AIInvalidResponse):
            return ERROR_INVALID_AI_OUTPUT
        if isinstance(exc, AIProviderError):
            return "AI_REQUEST_FAILED"
        return ERROR_GENERATION_FAILED

    def deck_title(self, document, config):
        return f"{document.original_name} {config['difficulty']} flashcards"

    def page_range_for_scope(self, scope):
        if scope.get("type") == "page_range":
            return {"start": scope["page_start"], "end": scope["page_end"]}
        return {}

    def page_reference(self, scope):
        if scope.get("type") == "page_range":
            return f"p. {scope['page_start']}-{scope['page_end']}"
        if scope.get("type") == "section":
            return f"section {scope['section_start']}-{scope['section_end']}"
        return ""

    def task_result(self, deck, cached=False):
        return {
            "status": deck.status,
            "document_id": str(deck.document_id),
            "deck_id": str(deck.id),
            "cached": cached,
            "requested_quantity": deck.requested_quantity,
            "generated_quantity": deck.generated_quantity,
            "error_code": deck.error_code,
        }

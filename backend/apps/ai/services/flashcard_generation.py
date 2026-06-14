import hashlib
import json
import re
from dataclasses import dataclass

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status as http_status

from apps.ai.models import Flashcard, FlashcardDeck, StudyDocument
from apps.ai.services.ai_client import AIClient
from apps.ai.services.document_summary import DocumentChunker
from apps.ai.services.exceptions import (
    AIInvalidResponse,
    AINotConfigured,
    AIProviderError,
    AIProviderUnavailable,
    AIRateLimited,
    AIServiceError,
    AITimeout,
)
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
    source_truncated: bool = False


@dataclass
class GenerationRequestResult:
    deck: FlashcardDeck
    cached: bool
    should_enqueue: bool
    created: bool


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
        self.client = client or AIClient(model=settings.FLASHCARD_GENERATION_MODEL)
        self.selector = selector or DocumentSourceSelector()
        self.chunker = chunker or DocumentChunker(
            chunk_characters=settings.FLASHCARD_GENERATION_CHUNK_CHARACTERS,
            max_chunks=settings.FLASHCARD_GENERATION_MAX_CHUNKS,
        )
        self.prompt_builder = prompt_builder or FlashcardPromptBuilder()
        self.validator = validator or FlashcardOutputValidator()

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
                if (
                    not force
                    and deck.status in {FlashcardDeck.Status.COMPLETED, FlashcardDeck.Status.PARTIAL}
                ):
                    return GenerationRequestResult(deck, cached=True, should_enqueue=False, created=False)
                if (
                    not force
                    and deck.status in {FlashcardDeck.Status.PENDING, FlashcardDeck.Status.PROCESSING}
                ):
                    return GenerationRequestResult(deck, cached=False, should_enqueue=False, created=False)
                deck.cards.all().delete()
                self.prepare_deck(deck, document, source, config, fingerprint)
                return GenerationRequestResult(deck, cached=False, should_enqueue=True, created=False)

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
            return GenerationRequestResult(deck, cached=False, should_enqueue=True, created=True)

    def generate(self, document_id, config, force=False):
        document = StudyDocument.objects.get(pk=document_id)
        config = self.normalize_config(config)
        request = self.request_generation(document, config, force=force)
        if request.cached and not force:
            return self.task_result(request.deck, cached=True)
        deck = request.deck
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
            cards = self.generate_cards(source, chunks, config)
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
            deck.save(
                update_fields=[
                    "status",
                    "quantity",
                    "generated_quantity",
                    "error_code",
                    "error_message",
                    "updated_at",
                ]
            )
        return self.task_result(deck, cached=False)

    def generate_cards(self, source, chunks, config):
        allocations = self.allocate_quantity(config["quantity"], chunks)
        cards = []
        for chunk, amount in zip(chunks, allocations):
            if amount <= 0:
                continue
            cards.extend(
                self.call_and_validate(
                    chunk.text,
                    amount,
                    config["difficulty"],
                    source.scope,
                    existing_questions=[card["question"] for card in cards],
                )
            )
            cards = self.dedupe(cards, config["quantity"])
        if len(cards) < config["quantity"]:
            missing = config["quantity"] - len(cards)
            cards.extend(
                self.call_and_validate(
                    source.text,
                    missing,
                    config["difficulty"],
                    {**source.scope, "fill_pass": True},
                    existing_questions=[card["question"] for card in cards],
                )
            )
        return self.dedupe(cards, config["quantity"])

    def call_and_validate(self, source_text, quantity, difficulty, scope_metadata, existing_questions):
        system_prompt, user_prompt = self.prompt_builder.build_messages(
            source_text,
            difficulty=difficulty,
            quantity=quantity,
            scope_metadata=scope_metadata,
            existing_questions=existing_questions,
        )
        response = self.client.complete_json(
            system_prompt,
            user_prompt,
            operation="flashcard_generation",
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

    def mark_processing(self, deck, source, chunk_count):
        deck.status = FlashcardDeck.Status.PROCESSING
        deck.generation_attempts += 1
        deck.provider = getattr(self.client, "PROVIDER", "openrouter")
        deck.model_name = settings.FLASHCARD_GENERATION_MODEL or settings.OPENROUTER_MODEL
        deck.source_character_count = source.source_character_count
        deck.source_truncated = source.source_truncated
        deck.error_code = ""
        deck.error_message = ""
        scope = dict(deck.scope or {})
        scope["chunk_count"] = chunk_count
        deck.scope = scope
        deck.save(
            update_fields=[
                "status",
                "generation_attempts",
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

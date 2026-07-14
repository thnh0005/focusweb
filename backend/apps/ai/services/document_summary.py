import hashlib
import json
import re
from dataclasses import dataclass
from math import floor

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status as http_status

from apps.ai.models import DocumentSummary, StudyDocument
from apps.ai.services.ai_client import AIClient
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
from apps.ai.services.prompt_builder import DocumentSummaryPromptBuilder
from apps.ai.services.token_counter import PreparedAIRequest, TokenCountingService


ERROR_EXTRACTION_NOT_READY = "EXTRACTION_NOT_READY"
ERROR_EXTRACTION_FAILED = "EXTRACTION_FAILED"
ERROR_NO_EXTRACTABLE_TEXT = "NO_EXTRACTABLE_TEXT"
ERROR_INVALID_AI_OUTPUT = "INVALID_AI_OUTPUT"
ERROR_SUMMARY_GENERATION_FAILED = "SUMMARY_GENERATION_FAILED"
PROMPT_VERSION = DocumentSummaryPromptBuilder.PROMPT_VERSION

MAX_TOTAL_TOKENS_PER_REQUEST = settings.AI_MAX_REQUEST_TOKENS
TARGET_TOTAL_TOKENS_PER_REQUEST = settings.AI_TARGET_REQUEST_TOKENS
CHUNK_RESERVED_OUTPUT_TOKENS = settings.AI_CHUNK_OUTPUT_RESERVE_TOKENS
CONTEXT_SUMMARY_MAX_TOKENS = settings.AI_CONTEXT_SUMMARY_MAX_TOKENS
CHUNK_OVERLAP_TOKENS = settings.AI_CHUNK_OVERLAP_TOKENS
KEY_POINTS_SUMMARY_RESERVED_OUTPUT_TOKENS = settings.AI_KEY_POINTS_SUMMARY_OUTPUT_RESERVE_TOKENS
DETAILED_SUMMARY_RESERVED_OUTPUT_TOKENS = settings.AI_DETAILED_SUMMARY_OUTPUT_RESERVE_TOKENS
FINAL_SUMMARY_RESERVED_OUTPUT_TOKENS = DETAILED_SUMMARY_RESERVED_OUTPUT_TOKENS
FLASHCARD_RESERVED_OUTPUT_TOKENS = settings.AI_FLASHCARD_OUTPUT_RESERVE_TOKENS
ENTITY_MEMORY_MAX_TOKENS = settings.AI_ENTITY_MEMORY_MAX_TOKENS
SAFETY_MARGIN_PERCENT = 8
CHAT_TEMPLATE_OVERHEAD_TOKENS = 120
MIN_OVERLAP_TOKENS = 50


def reserved_output_tokens_for(mode, phase):
    if phase not in {"final", "reduce"}:
        return CHUNK_RESERVED_OUTPUT_TOKENS
    if mode == DocumentSummary.Mode.KEY_POINTS:
        return KEY_POINTS_SUMMARY_RESERVED_OUTPUT_TOKENS
    return DETAILED_SUMMARY_RESERVED_OUTPUT_TOKENS


def estimate_tokens(value):
    text = str(value or "")
    if not text:
        return 0
    model = settings.GROQ_MODEL or settings.OPENROUTER_MODEL or "model"
    return TokenCountingService().count_text_tokens(model, text)


def trim_to_token_budget(value, max_tokens):
    text = str(value or "").strip()
    if estimate_tokens(text) <= max_tokens:
        return text
    model = settings.GROQ_MODEL or settings.OPENROUTER_MODEL or "model"
    tokenizer = TokenCountingService().get_tokenizer(model)
    return tokenizer.decode(tokenizer.encode(text, add_special_tokens=False)[:max(0, max_tokens)]).strip()


def estimate_request_tokens(system_prompt, user_prompt, max_completion_tokens):
    return (
        estimate_tokens(system_prompt)
        + estimate_tokens(user_prompt)
        + max_completion_tokens
        + CHAT_TEMPLATE_OVERHEAD_TOKENS
    )


def calculate_dynamic_chunk_budget(
    model=None,
    system_prompt="",
    metadata="",
    rolling_context="",
    entity_memory="",
    overlap="",
    reserved_output_tokens=CHUNK_RESERVED_OUTPUT_TOKENS,
    max_total_tokens=MAX_TOTAL_TOKENS_PER_REQUEST,
):
    del model
    fixed_tokens = (
        estimate_tokens(system_prompt)
        + estimate_tokens(metadata)
        + estimate_tokens(rolling_context)
        + estimate_tokens(entity_memory)
        + estimate_tokens(overlap)
        + reserved_output_tokens
        + CHAT_TEMPLATE_OVERHEAD_TOKENS
    )
    safety_margin = floor(max_total_tokens * SAFETY_MARGIN_PERCENT / 100)
    return max(1, max_total_tokens - fixed_tokens - safety_margin)


class RequestTokenBudget:
    def __init__(self, max_total_tokens=TARGET_TOTAL_TOKENS_PER_REQUEST):
        self.max_total_tokens = max_total_tokens
        self.token_service = TokenCountingService()

    def enforce(self, system_prompt, user_prompt, reserved_output_tokens):
        if self.fits(system_prompt, user_prompt, reserved_output_tokens):
            return user_prompt

        shrunk = user_prompt
        for tag in ("previous_chunk_tail", "accumulated_context", "known_entities", "current_chunk", "DOCUMENT_CONTENT", "DOCUMENT_SOURCE"):
            shrunk = self.shrink_tag(shrunk, tag, reserved_output_tokens)
            if self.fits(system_prompt, shrunk, reserved_output_tokens):
                return shrunk

        shrunk = trim_to_token_budget(
            shrunk,
            max(1, self.max_total_tokens - estimate_tokens(system_prompt) - reserved_output_tokens - CHAT_TEMPLATE_OVERHEAD_TOKENS - 50),
        )
        while not self.fits(system_prompt, shrunk, reserved_output_tokens) and len(shrunk) > 200:
            shrunk = trim_to_token_budget(shrunk, max(1, floor(estimate_tokens(shrunk) * 0.9)))
        return shrunk

    def fits(self, system_prompt, user_prompt, reserved_output_tokens):
        model = settings.DOCUMENT_SUMMARY_MODEL or settings.GROQ_MODEL or settings.OPENROUTER_MODEL or "model"
        request = PreparedAIRequest(
            operation="document_summary",
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=reserved_output_tokens,
            prompt_version=PROMPT_VERSION,
        )
        estimate = self.token_service.estimate_request(request, settings.AI_PROVIDER)
        target = min(self.max_total_tokens, estimate.context_window)
        return (
            estimate.estimated_total_tokens <= target
            and estimate.estimated_total_tokens <= settings.AI_MAX_REQUEST_TOKENS
        )

    def shrink_tag(self, prompt, tag, reserved_output_tokens):
        pattern = re.compile(rf"(<{tag}>)(.*?)(</{tag}>)", re.DOTALL)
        match = pattern.search(prompt)
        if not match:
            return prompt
        content = match.group(2).strip()
        current_tokens = estimate_tokens(content)
        if current_tokens <= 1:
            return prompt
        prompt_without_content = prompt[: match.start(2)] + prompt[match.end(2) :]
        available = self.max_total_tokens - estimate_tokens(prompt_without_content) - reserved_output_tokens - CHAT_TEMPLATE_OVERHEAD_TOKENS
        available = max(1, floor(available * 0.92))
        if tag == "previous_chunk_tail":
            available = max(MIN_OVERLAP_TOKENS, min(available, current_tokens))
        replacement = trim_to_token_budget(content, available)
        return prompt[: match.start(2)] + f"\n{replacement}\n" + prompt[match.end(2) :]


class DocumentSummaryError(Exception):
    def __init__(self, code, message, status_code=http_status.HTTP_400_BAD_REQUEST):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code

    def response_data(self):
        return {"error": {"code": self.code, "message": self.message}}


@dataclass
class SummaryRequestResult:
    summary: DocumentSummary
    cached: bool
    should_enqueue: bool
    created: bool


@dataclass
class DocumentChunk:
    index: int
    text: str
    start_char: int
    end_char: int
    total_chunks: int = 1
    chapter_title: str = ""
    section_title: str = ""
    previous_section_title: str = ""
    next_section_title: str = ""
    token_count: int = 0
    start_token: int = 0
    end_token: int = 0
    document_progress_percent: int = 0
    previous_tail: str = ""

    def metadata(self):
        return {
            "chunk_index": self.index,
            "total_chunks": self.total_chunks,
            "chapter_title": self.chapter_title,
            "section_title": self.section_title,
            "previous_section_title": self.previous_section_title,
            "next_section_title": self.next_section_title,
            "token_count": self.token_count,
            "start_token": self.start_token,
            "end_token": self.end_token,
            "document_progress_percent": self.document_progress_percent,
        }


@dataclass
class ChunkingResult:
    chunks: list[DocumentChunk]
    source_truncated: bool


class DocumentChunker:
    def __init__(
        self,
        chunk_characters=None,
        overlap_characters=None,
        max_chunks=None,
        max_source_characters=None,
    ):
        self.chunk_characters = chunk_characters or settings.DOCUMENT_SUMMARY_CHUNK_CHARACTERS
        self.overlap_characters = min(
            overlap_characters
            if overlap_characters is not None
            else settings.DOCUMENT_SUMMARY_CHUNK_OVERLAP_CHARACTERS,
            max(0, self.chunk_characters // 4),
        )
        self.max_chunks = max_chunks or settings.DOCUMENT_SUMMARY_MAX_CHUNKS
        self.max_source_characters = (
            max_source_characters or settings.DOCUMENT_SUMMARY_MAX_SOURCE_CHARACTERS
        )

    def chunk(self, text, page_map=None):
        source = (text or "").strip()
        source_truncated = len(source) > self.max_source_characters
        source = source[: self.max_source_characters].strip()
        if not source:
            return ChunkingResult([], source_truncated)
        if len(source) <= self.chunk_characters:
            chunk = DocumentChunk(1, source, 0, len(source))
            self.enrich_chunks([chunk], source)
            return ChunkingResult([chunk], source_truncated)

        chunks = []
        start = 0
        while start < len(source) and len(chunks) < self.max_chunks:
            hard_end = min(start + self.chunk_characters, len(source))
            end = self.find_boundary(source, start, hard_end)
            chunk_text = source[start:end].strip()
            if chunk_text:
                chunks.append(DocumentChunk(len(chunks) + 1, chunk_text, start, end))
            if end >= len(source):
                break
            next_start = max(end - self.overlap_characters, start + 1)
            start = next_start if self.overlap_characters == 0 else self.find_forward_boundary(source, next_start)

        if chunks and chunks[-1].end_char < len(source):
            source_truncated = True
        self.enrich_chunks(chunks, source)
        return ChunkingResult(chunks, source_truncated)

    def enrich_chunks(self, chunks, source):
        total = len(chunks)
        sections = self.detect_sections(source)
        previous_tail = ""
        for chunk in chunks:
            chunk.total_chunks = total
            chunk.token_count = estimate_tokens(chunk.text)
            chunk.start_token = estimate_tokens(source[: chunk.start_char])
            chunk.end_token = chunk.start_token + chunk.token_count
            chunk.document_progress_percent = min(100, round((chunk.end_char / max(1, len(source))) * 100))
            chunk.section_title = self.section_for_position(sections, chunk.start_char)
            chunk.chapter_title = self.chapter_for_title(chunk.section_title)
            chunk.previous_section_title = self.section_for_position(sections, max(0, chunk.start_char - 1))
            chunk.next_section_title = self.next_section_for_position(sections, chunk.end_char)
            chunk.previous_tail = previous_tail
            previous_tail = trim_to_token_budget(chunk.text, CHUNK_OVERLAP_TOKENS)

    def detect_sections(self, source):
        sections = []
        offset = 0
        for line in source.splitlines(True):
            stripped = line.strip()
            if self.is_heading(stripped):
                sections.append({"title": stripped[:180], "start": offset})
            offset += len(line)
        if not sections:
            sections.append({"title": "Document", "start": 0})
        return sections

    def is_heading(self, line):
        if not line or len(line) > 140:
            return False
        if re.match(r"^(chapter|chương|chuong)\s+[\divxlcdm]+", line, re.IGNORECASE):
            return True
        if re.match(r"^\d+(\.\d+)*[\).]?\s+\S+", line):
            return True
        letters = re.sub(r"[^A-Za-zÀ-ỹ]", "", line)
        return len(letters) >= 4 and letters.upper() == letters

    def section_for_position(self, sections, position):
        current = sections[0]["title"]
        for section in sections:
            if section["start"] <= position:
                current = section["title"]
            else:
                break
        return current

    def next_section_for_position(self, sections, position):
        for section in sections:
            if section["start"] > position:
                return section["title"]
        return ""

    def chapter_for_title(self, title):
        if re.match(r"^(chapter|chương|chuong)\s+", title or "", re.IGNORECASE):
            return title
        return ""

    def find_boundary(self, source, start, hard_end):
        if hard_end >= len(source):
            return len(source)
        window = source[start:hard_end]
        for separator in ("\n\n", "\n", ". ", "? ", "! "):
            position = window.rfind(separator)
            if position >= int(self.chunk_characters * 0.55):
                return start + position + len(separator)
        return hard_end

    def find_forward_boundary(self, source, start):
        if start <= 0:
            return 0
        for separator in ("\n\n", "\n", ". "):
            position = source.find(separator, start, min(len(source), start + 120))
            if position != -1:
                return position + len(separator)
        return start


class DocumentSummaryOutputValidator:
    MAX_KEY_POINTS = 12
    MAX_SECTIONS = 10
    MAX_FIELD_CHARS = 4000

    def parse_and_validate(self, content, mode):
        try:
            parsed = json.loads(self.extract_json(content))
        except (TypeError, json.JSONDecodeError) as exc:
            raise AIInvalidResponse("Document summary JSON was invalid.") from exc

        if not isinstance(parsed, dict):
            raise AIInvalidResponse("Document summary JSON must be an object.")
        if mode == DocumentSummary.Mode.KEY_POINTS:
            return self.validate_key_points(parsed)
        return self.validate_detailed(parsed)

    def extract_json(self, content):
        text = str(content or "").strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        return text

    def validate_key_points(self, parsed):
        key_points = parsed.get("key_points")
        if not isinstance(key_points, list):
            raise AIInvalidResponse("Document summary key_points must be a list.")
        cleaned = []
        for item in key_points:
            if not isinstance(item, dict):
                continue
            title = self.clean_text(item.get("title"), 160)
            content = self.clean_text(item.get("content"), self.MAX_FIELD_CHARS)
            if title and content:
                cleaned.append({"title": title, "content": content})
            if len(cleaned) >= self.MAX_KEY_POINTS:
                break
        if not cleaned:
            raise AIInvalidResponse("Document summary key_points were empty.")
        return {
            "language": self.clean_text(parsed.get("language"), 16) or "unknown",
            "key_points": cleaned,
        }

    def validate_detailed(self, parsed):
        sections = parsed.get("sections")
        if not isinstance(sections, list):
            raise AIInvalidResponse("Document summary sections must be a list.")
        cleaned_sections = []
        for item in sections:
            if not isinstance(item, dict):
                continue
            heading = self.clean_text(item.get("heading"), 180)
            content = self.clean_text(item.get("content"), self.MAX_FIELD_CHARS)
            if heading and content:
                cleaned_sections.append({"heading": heading, "content": content})
            if len(cleaned_sections) >= self.MAX_SECTIONS:
                break
        title = self.clean_text(parsed.get("title"), 220)
        overview = self.clean_text(parsed.get("overview"), self.MAX_FIELD_CHARS)
        conclusion = self.clean_text(parsed.get("conclusion"), self.MAX_FIELD_CHARS)
        if not title or not overview or not cleaned_sections:
            raise AIInvalidResponse("Document summary detailed fields were incomplete.")
        return {
            "language": self.clean_text(parsed.get("language"), 16) or "unknown",
            "title": title,
            "overview": overview,
            "sections": cleaned_sections,
            "conclusion": conclusion,
        }

    def clean_text(self, value, limit):
        text = str(value or "").strip()
        text = re.sub(r"<[^>]+>", "", text)
        return text[:limit].strip()

    def render_markdown(self, structured, mode):
        if mode == DocumentSummary.Mode.KEY_POINTS:
            return "\n".join(
                f"- **{item['title']}:** {item['content']}"
                for item in structured["key_points"]
            )
        sections = "\n\n".join(
            f"### {section['heading']}\n{section['content']}"
            for section in structured["sections"]
        )
        return (
            f"## {structured['title']}\n\n"
            f"{structured['overview']}\n\n"
            f"{sections}\n\n"
            f"### Conclusion\n{structured.get('conclusion', '')}"
        ).strip()


class DocumentContextOutputValidator:
    MAX_ITEMS = 16

    def __init__(self, summary_validator=None):
        self.summary_validator = summary_validator or DocumentSummaryOutputValidator()

    def parse_and_validate(self, content, mode, chunk_index):
        parsed = json.loads(self.summary_validator.extract_json(content))
        if not isinstance(parsed, dict):
            raise AIInvalidResponse("Chunk context JSON must be an object.")
        if "updated_context_summary" not in parsed:
            structured = self.summary_validator.parse_and_validate(content, mode)
            return {
                "partial_summary": self.summary_validator.render_markdown(structured, mode),
                "key_points": self.key_points_from_structured(structured, mode),
                "important_terms": [],
                "entities": [],
                "relationships": [],
                "open_context": [],
                "flashcard_candidates": [],
                "context_updates": [],
                "updated_context_summary": trim_to_token_budget(
                    self.summary_validator.render_markdown(structured, mode),
                    CONTEXT_SUMMARY_MAX_TOKENS,
                ),
                "structured_summary": structured,
            }

        return {
            "partial_summary": self.clean_text(parsed.get("partial_summary"), 5000),
            "key_points": self.clean_list(parsed.get("key_points"), 500),
            "important_terms": self.clean_objects(parsed.get("important_terms"), chunk_index),
            "entities": self.clean_objects(parsed.get("entities"), chunk_index),
            "relationships": self.clean_objects(parsed.get("relationships"), chunk_index),
            "open_context": self.clean_list(parsed.get("open_context"), 500),
            "flashcard_candidates": self.clean_objects(parsed.get("flashcard_candidates"), chunk_index),
            "context_updates": self.clean_objects(parsed.get("context_updates"), chunk_index),
            "updated_context_summary": trim_to_token_budget(
                self.clean_text(parsed.get("updated_context_summary"), 4000),
                CONTEXT_SUMMARY_MAX_TOKENS,
            ),
            "structured_summary": self.structured_from_chunk(parsed, mode),
        }

    def key_points_from_structured(self, structured, mode):
        if mode == DocumentSummary.Mode.KEY_POINTS:
            return [
                f"{item.get('title')}: {item.get('content')}"
                for item in structured.get("key_points", [])
            ][: self.MAX_ITEMS]
        return [
            f"{item.get('heading')}: {item.get('content')}"
            for item in structured.get("sections", [])
        ][: self.MAX_ITEMS]

    def structured_from_chunk(self, parsed, mode):
        if mode == DocumentSummary.Mode.KEY_POINTS:
            key_points = [
                {"title": f"Point {index + 1}", "content": point}
                for index, point in enumerate(self.clean_list(parsed.get("key_points"), 700))
            ]
            if not key_points and parsed.get("partial_summary"):
                key_points = [{"title": "Summary", "content": self.clean_text(parsed.get("partial_summary"), 1200)}]
            return {"language": self.clean_text(parsed.get("language"), 16) or "unknown", "key_points": key_points}
        partial = self.clean_text(parsed.get("partial_summary"), 2000)
        return {
            "language": self.clean_text(parsed.get("language"), 16) or "unknown",
            "title": self.clean_text(parsed.get("title"), 220) or "Chunk summary",
            "overview": partial or "No new information extracted.",
            "sections": [{"heading": "Current chunk", "content": partial or "No new information extracted."}],
            "conclusion": self.clean_text(parsed.get("conclusion"), 1000) or partial or "No conclusion extracted.",
        }

    def clean_text(self, value, limit):
        text = str(value or "").strip()
        text = re.sub(r"<[^>]+>", "", text)
        return text[:limit].strip()

    def clean_list(self, value, limit):
        if not isinstance(value, list):
            return []
        cleaned = []
        for item in value:
            text = self.clean_text(item, limit)
            if text:
                cleaned.append(text)
            if len(cleaned) >= self.MAX_ITEMS:
                break
        return cleaned

    def clean_objects(self, value, chunk_index):
        if not isinstance(value, list):
            return []
        cleaned = []
        for item in value:
            if not isinstance(item, dict):
                continue
            next_item = {}
            for key, raw in item.items():
                if isinstance(raw, (str, int, float, bool)):
                    next_item[str(key)[:80]] = self.clean_text(raw, 700)
                elif isinstance(raw, list):
                    next_item[str(key)[:80]] = raw[:10]
            if next_item:
                next_item.setdefault("source_chunk_index", chunk_index)
                cleaned.append(next_item)
            if len(cleaned) >= self.MAX_ITEMS:
                break
        return cleaned


class RollingDocumentContext:
    def __init__(self):
        self.summary = ""
        self.entity_memory = {"terms": [], "entities": []}
        self.open_context = []
        self.context_updates = []
        self.chunk_results = []

    def payload(self):
        return {
            "rolling_context_summary": self.summary,
            "rolling_context_token_count": estimate_tokens(self.summary),
            "entity_memory_json": self.entity_memory,
            "open_context_json": self.open_context,
            "last_completed_chunk_index": self.chunk_results[-1]["chunk"] if self.chunk_results else 0,
        }

    def selected_entity_memory(self):
        combined = {
            "terms": self.entity_memory.get("terms", [])[-12:],
            "entities": self.entity_memory.get("entities", [])[-12:],
        }
        return trim_to_token_budget(json.dumps(combined, ensure_ascii=False), ENTITY_MEMORY_MAX_TOKENS)

    def apply(self, chunk, chunk_result):
        self.summary = trim_to_token_budget(
            chunk_result.get("updated_context_summary", self.summary),
            CONTEXT_SUMMARY_MAX_TOKENS,
        )
        self.open_context = chunk_result.get("open_context", [])[:10]
        self.context_updates.extend(chunk_result.get("context_updates", []))
        self.merge_entities(chunk_result.get("important_terms", []), "terms", chunk.index)
        self.merge_entities(chunk_result.get("entities", []), "entities", chunk.index)
        self.chunk_results.append(
            {
                "chunk": chunk.index,
                "metadata": chunk.metadata(),
                "partial_summary": chunk_result.get("partial_summary", ""),
                "key_points": chunk_result.get("key_points", []),
                "context_updates": chunk_result.get("context_updates", []),
                "relationships": chunk_result.get("relationships", []),
                "flashcard_candidates": chunk_result.get("flashcard_candidates", []),
                "updated_context_summary": self.summary,
                "structured_summary": chunk_result.get("structured_summary", {}),
                "input_context_version": max(0, chunk.index - 1),
            }
        )

    def merge_entities(self, items, key, chunk_index):
        memory = self.entity_memory.setdefault(key, [])
        by_name = {str(item.get("name") or item.get("term") or "").lower(): item for item in memory}
        for item in items:
            name = str(item.get("name") or item.get("term") or "").strip()
            if not name:
                continue
            normalized = name.lower()
            existing = by_name.get(normalized)
            if existing:
                existing.update({k: v for k, v in item.items() if v})
                existing["last_seen_chunk"] = chunk_index
            else:
                next_item = dict(item)
                next_item.setdefault("name", name)
                next_item.setdefault("first_seen_chunk", chunk_index)
                next_item["last_seen_chunk"] = chunk_index
                memory.append(next_item)
                by_name[normalized] = next_item
        self.entity_memory[key] = memory[-24:]


class DocumentSummaryService:
    def __init__(self, client=None, chunker=None, prompt_builder=None, validator=None):
        self.client = client or AIClient(model=settings.DOCUMENT_SUMMARY_MODEL, max_retries=0)
        self.chunker = chunker or DocumentChunker()
        self.prompt_builder = prompt_builder or DocumentSummaryPromptBuilder()
        self.validator = validator or DocumentSummaryOutputValidator()
        self.context_validator = DocumentContextOutputValidator(self.validator)
        self.token_budget = RequestTokenBudget()
        self.chunk_request_delay_seconds = getattr(settings, "DOCUMENT_CHUNK_REQUEST_DELAY_SECONDS", 60)

    def request_summary(self, document, mode, force=False):
        self.validate_document_ready(document)
        checksum = self.current_checksum(document)
        with transaction.atomic():
            summary, created = DocumentSummary.objects.select_for_update().get_or_create(
                document=document,
                mode=mode,
                defaults={
                    "status": DocumentSummary.Status.PENDING,
                    "input_checksum": checksum,
                    "prompt_version": PROMPT_VERSION,
                },
            )
            checksum_changed = summary.input_checksum and summary.input_checksum != checksum
            prompt_changed = summary.prompt_version and summary.prompt_version != PROMPT_VERSION
            if (checksum_changed or prompt_changed) and summary.status == DocumentSummary.Status.COMPLETED:
                summary.status = DocumentSummary.Status.STALE
                summary.save(update_fields=["status", "updated_at"])

            if (
                not force
                and summary.status == DocumentSummary.Status.COMPLETED
                and summary.input_checksum == checksum
                and summary.prompt_version == PROMPT_VERSION
            ):
                return SummaryRequestResult(summary, cached=True, should_enqueue=False, created=created)

            if (
                summary.status in {DocumentSummary.Status.PENDING, DocumentSummary.Status.PROCESSING}
                and summary.error_code == "AI_QUOTA_DEFERRED"
                and summary.input_checksum == checksum
                and summary.prompt_version == PROMPT_VERSION
                and self.has_summary_checkpoint(summary)
            ):
                return SummaryRequestResult(
                    summary,
                    cached=False,
                    should_enqueue=False,
                    created=created,
                )

            if (
                not created
                and not force
                and summary.status in {
                    DocumentSummary.Status.PENDING,
                    DocumentSummary.Status.PROCESSING,
                }
                and summary.input_checksum == checksum
                and summary.prompt_version == PROMPT_VERSION
            ):
                return SummaryRequestResult(
                    summary,
                    cached=False,
                    should_enqueue=False,
                    created=created,
                )

            summary.status = DocumentSummary.Status.PENDING
            summary.input_checksum = checksum
            summary.content = "" if force or checksum_changed or prompt_changed else summary.content
            summary.structured_content = {} if force or checksum_changed or prompt_changed else summary.structured_content
            summary.error_code = ""
            summary.error_message = ""
            summary.prompt_version = PROMPT_VERSION
            summary.source = "ai"
            summary.model_name = ""
            summary.provider = ""
            summary.generated_at = None
            summary.save(
                update_fields=[
                    "status",
                    "input_checksum",
                    "content",
                    "structured_content",
                    "error_code",
                    "error_message",
                    "prompt_version",
                    "source",
                    "model_name",
                    "provider",
                    "generated_at",
                    "updated_at",
                ]
            )
            return SummaryRequestResult(summary, cached=False, should_enqueue=True, created=created)

    def has_summary_checkpoint(self, summary):
        checkpoint = ((summary.structured_content or {}).get("processing_context") or {})
        return bool(isinstance(checkpoint, dict) and checkpoint.get("chunks"))

    def generate(self, document_id, mode, force=False):
        document = StudyDocument.objects.get(pk=document_id)
        self.validate_document_ready(document)
        request = self.request_summary(document, mode, force=force)
        if request.cached and not force:
            return self.task_result(request.summary, cached=True)
        summary = self.claim_summary_for_generation(request.summary.id, force=force)
        if summary is None:
            latest = DocumentSummary.objects.get(id=request.summary.id)
            return self.task_result(latest, cached=False)

        chunking = self.chunker.chunk(
            document.extracted_text,
            page_map=(document.metadata or {}).get("extraction", {}).get("page_map", []),
        )
        if not chunking.chunks:
            self.fail_summary(summary, ERROR_NO_EXTRACTABLE_TEXT, "No extractable text.")
            raise DocumentSummaryError(
                ERROR_NO_EXTRACTABLE_TEXT,
                "This document does not contain extractable text.",
                http_status.HTTP_409_CONFLICT,
            )

        self.mark_processing(summary, document, chunking)
        try:
            structured, context_payload = self.generate_structured_summary(
                mode,
                chunking.chunks,
                document,
                summary=summary,
            )
        except AIQuotaDeferred:
            self.defer_summary(summary)
            raise
        except AIServiceError as exc:
            code = self.map_ai_error(exc)
            self.fail_summary(summary, code, exc.safe_message)
            raise
        except Exception as exc:
            self.fail_summary(
                summary,
                ERROR_SUMMARY_GENERATION_FAILED,
                "Summary generation failed.",
            )
            raise

        content = self.validator.render_markdown(structured, mode)
        summary.structured_content = structured
        summary.structured_content["processing_context"] = context_payload
        summary.content = content
        summary.status = DocumentSummary.Status.COMPLETED
        summary.error_code = ""
        summary.error_message = ""
        summary.generated_at = timezone.now()
        summary.save(
            update_fields=[
                "structured_content",
                "content",
                "status",
                "error_code",
                "error_message",
                "generated_at",
                "updated_at",
            ]
        )
        return self.task_result(summary, cached=False)

    def generate_structured_summary(self, mode, chunks, document=None, summary=None):
        if len(chunks) == 1:
            return self.call_and_validate(mode, chunks[0].text, phase="final", document=document), {}

        context = self.restore_summary_checkpoint(summary, chunks) if summary else RollingDocumentContext()
        completed_chunks = {item.get("chunk") for item in context.chunk_results}
        for position, chunk in enumerate(chunks):
            if chunk.index in completed_chunks:
                continue
            chunk_result = self.call_and_validate_context(mode, chunk, context, document)
            context.apply(chunk, chunk_result)
            self.save_summary_checkpoint(summary, context)
            if position < len(chunks) - 1:
                self.wait_between_ai_requests()
        self.wait_between_ai_requests()
        chunk_summaries = self.chunk_summaries_from_context(context)
        reduce_source = json.dumps(
            {
                "chunk_summaries": chunk_summaries,
                "context_updates": context.context_updates,
                "entity_memory": context.entity_memory,
                "final_rolling_context": context.summary,
                "flashcard_candidates": [
                    candidate
                    for chunk_result in context.chunk_results
                    for candidate in chunk_result.get("flashcard_candidates", [])
                ],
            },
            ensure_ascii=False,
            sort_keys=True,
        )
        try:
            structured = self.call_and_validate(mode, reduce_source, phase="reduce", document=document)
        except AIInvalidResponse:
            structured = self.fallback_final_summary(mode, context)
        return structured, {
            **self.summary_checkpoint_payload(context),
            "chunks": context.chunk_results,
        }

    def chunk_summaries_from_context(self, context):
        return [
            {
                "chunk": item.get("chunk"),
                "metadata": item.get("metadata", {}),
                "summary": item.get("structured_summary", {}),
                "partial_summary": item.get("partial_summary", ""),
                "key_points": item.get("key_points", []),
                "context_updates": item.get("context_updates", []),
                "relationships": item.get("relationships", []),
            }
            for item in context.chunk_results
        ]

    def summary_checkpoint_payload(self, context):
        return {
            **context.payload(),
            "context_updates": context.context_updates,
            "chunks": context.chunk_results,
        }

    def save_summary_checkpoint(self, summary, context):
        if summary is None:
            return
        summary.structured_content = {
            "processing_context": self.summary_checkpoint_payload(context),
        }
        summary.save(update_fields=["structured_content", "updated_at"])

    def restore_summary_checkpoint(self, summary, chunks):
        context = RollingDocumentContext()
        checkpoint = ((summary.structured_content or {}).get("processing_context") or {})
        saved_chunks = checkpoint.get("chunks") if isinstance(checkpoint, dict) else []
        if not isinstance(saved_chunks, list):
            return context

        expected_indices = [chunk.index for chunk in chunks]
        expected_by_index = {chunk.index: chunk for chunk in chunks}
        restored = []
        for expected_index in expected_indices:
            match = next(
                (
                    item
                    for item in saved_chunks
                    if isinstance(item, dict) and item.get("chunk") == expected_index
                ),
                None,
            )
            if not match:
                break
            restored.append(match)

        context.chunk_results = restored
        if restored:
            context.summary = str(
                restored[-1].get("updated_context_summary")
                or checkpoint.get("rolling_context_summary")
                or ""
            )
        elif isinstance(checkpoint, dict):
            context.summary = str(checkpoint.get("rolling_context_summary") or "")

        entity_memory = checkpoint.get("entity_memory_json") if isinstance(checkpoint, dict) else None
        if isinstance(entity_memory, dict):
            context.entity_memory = entity_memory
        open_context = checkpoint.get("open_context_json") if isinstance(checkpoint, dict) else None
        if isinstance(open_context, list):
            context.open_context = open_context
        context_updates = checkpoint.get("context_updates") if isinstance(checkpoint, dict) else None
        if isinstance(context_updates, list):
            context.context_updates = context_updates
        else:
            context.context_updates = [
                update
                for item in restored
                for update in item.get("context_updates", [])
            ]

        for item in context.chunk_results:
            chunk = expected_by_index.get(item.get("chunk"))
            if chunk and not item.get("metadata"):
                item["metadata"] = chunk.metadata()
        return context

    def wait_between_ai_requests(self):
        return None

    def call_and_validate_context(self, mode, chunk, context, document):
        system_prompt, user_prompt = self.prompt_builder.build_contextual_chunk_messages(
            mode,
            chunk,
            rolling_context=context.summary,
            entity_memory=context.selected_entity_memory(),
            open_context=context.open_context,
            document=document,
        )
        user_prompt = self.token_budget.enforce(system_prompt, user_prompt, CHUNK_RESERVED_OUTPUT_TOKENS)
        last_error = None
        for attempt in range(2):
            try:
                response = self.client.complete_json(
                    system_prompt,
                    user_prompt,
                    operation="document_summary",
                    prompt_version=PROMPT_VERSION,
                    max_completion_tokens=CHUNK_RESERVED_OUTPUT_TOKENS,
                    document_id=document.id,
                    chunk_id=str(chunk.index),
                )
            except AIQuotaDeferred:
                if last_error is not None:
                    return self.fallback_chunk_context(mode, chunk, last_error)
                raise
            try:
                return self.context_validator.parse_and_validate(
                    response["content"],
                    mode,
                    chunk.index,
                )
            except (AIInvalidResponse, json.JSONDecodeError) as exc:
                last_error = exc
                self.wait_between_ai_requests()
                user_prompt += (
                    "\n\nThe previous response was invalid. Return valid JSON only "
                    "using the requested chunk schema. Do not include markdown."
                )
                user_prompt = self.token_budget.enforce(system_prompt, user_prompt, CHUNK_RESERVED_OUTPUT_TOKENS)
        return self.fallback_chunk_context(mode, chunk, last_error)

    def fallback_chunk_context(self, mode, chunk, error=None):
        del error
        excerpt = trim_to_token_budget(chunk.text, CONTEXT_SUMMARY_MAX_TOKENS)
        first_sentences = self.extract_sentences(chunk.text, limit=4)
        if mode == DocumentSummary.Mode.KEY_POINTS:
            structured = {
                "language": "unknown",
                "key_points": [
                    {"title": f"Chunk {chunk.index}", "content": sentence}
                    for sentence in first_sentences[: DocumentSummaryOutputValidator.MAX_KEY_POINTS]
                ]
                or [{"title": f"Chunk {chunk.index}", "content": excerpt}],
            }
        else:
            structured = {
                "language": "unknown",
                "title": f"Chunk {chunk.index} summary",
                "overview": first_sentences[0] if first_sentences else excerpt,
                "sections": [{"heading": f"Chunk {chunk.index}", "content": excerpt}],
                "conclusion": first_sentences[-1] if first_sentences else excerpt,
            }
        return {
            "partial_summary": self.validator.render_markdown(structured, mode),
            "key_points": first_sentences,
            "important_terms": [],
            "entities": [],
            "relationships": [],
            "open_context": [],
            "flashcard_candidates": [],
            "context_updates": [],
            "updated_context_summary": excerpt,
            "structured_summary": structured,
        }

    def fallback_final_summary(self, mode, context):
        chunks = context.chunk_results or []
        if mode == DocumentSummary.Mode.KEY_POINTS:
            key_points = []
            for item in chunks:
                for point in item.get("key_points", []):
                    key_points.append(
                        {"title": f"Chunk {item.get('chunk')}", "content": str(point)[:1200]}
                    )
                    if len(key_points) >= DocumentSummaryOutputValidator.MAX_KEY_POINTS:
                        break
                if len(key_points) >= DocumentSummaryOutputValidator.MAX_KEY_POINTS:
                    break
            return {
                "language": "unknown",
                "key_points": key_points
                or [{"title": "Summary", "content": context.summary or "No summary was produced."}],
            }

        sections = []
        for item in chunks:
            partial = str(item.get("partial_summary") or item.get("updated_context_summary") or "").strip()
            if partial:
                sections.append({"heading": f"Chunk {item.get('chunk')}", "content": partial[:4000]})
            if len(sections) >= DocumentSummaryOutputValidator.MAX_SECTIONS:
                break
        overview = context.summary or (sections[0]["content"] if sections else "No summary was produced.")
        return {
            "language": "unknown",
            "title": "Document summary",
            "overview": overview[:4000],
            "sections": sections or [{"heading": "Summary", "content": overview[:4000]}],
            "conclusion": overview[:1000],
        }

    def extract_sentences(self, text, limit=4):
        sentences = []
        for part in re.split(r"(?<=[.!?。！？])\s+|\n+", str(text or "")):
            cleaned = re.sub(r"\s+", " ", part).strip()
            if cleaned:
                sentences.append(cleaned[:1200])
            if len(sentences) >= limit:
                break
        return sentences

    def call_and_validate(self, mode, source_text, phase, document=None):
        system_prompt, user_prompt = self.prompt_builder.build_messages(
            mode,
            source_text,
            phase=phase,
        )
        reserved = reserved_output_tokens_for(mode, phase)
        user_prompt = self.token_budget.enforce(system_prompt, user_prompt, reserved)
        last_error = None
        for attempt in range(2):
            response = self.client.complete_json(
                system_prompt,
                user_prompt,
                operation="document_summary",
                prompt_version=PROMPT_VERSION,
                max_completion_tokens=reserved,
                document_id=document.id if document else None,
            )
            try:
                return self.validator.parse_and_validate(response["content"], mode)
            except AIInvalidResponse as exc:
                last_error = exc
                self.wait_between_ai_requests()
                user_prompt += (
                    "\n\nThe previous response was invalid. Return valid JSON only "
                    "using the requested schema. Do not include markdown."
                )
        raise last_error or AIInvalidResponse("Document summary output was invalid.")

    def validate_document_ready(self, document):
        extraction = (document.metadata or {}).get("extraction", {})
        extraction_status = extraction.get("status", "")
        if document.status == StudyDocument.Status.ERROR or extraction_status == "failed":
            raise DocumentSummaryError(
                ERROR_EXTRACTION_FAILED,
                "Document text could not be extracted.",
                http_status.HTTP_409_CONFLICT,
            )
        if document.status in {StudyDocument.Status.UPLOADED, StudyDocument.Status.PROCESSING}:
            raise DocumentSummaryError(
                ERROR_EXTRACTION_NOT_READY,
                "Document text extraction is still in progress.",
                http_status.HTTP_409_CONFLICT,
            )
        if extraction_status in {"processing", "pending"}:
            raise DocumentSummaryError(
                ERROR_EXTRACTION_NOT_READY,
                "Document text extraction is still in progress.",
                http_status.HTTP_409_CONFLICT,
            )
        if extraction_status == "empty" or not (document.extracted_text or "").strip():
            raise DocumentSummaryError(
                ERROR_NO_EXTRACTABLE_TEXT,
                "This document does not contain extractable text.",
                http_status.HTTP_409_CONFLICT,
            )

    def current_checksum(self, document):
        extraction = (document.metadata or {}).get("extraction", {})
        checksum = extraction.get("checksum")
        if checksum:
            return checksum
        return hashlib.sha256((document.extracted_text or "").encode("utf-8")).hexdigest()

    def claim_summary_for_generation(self, summary_id, force=False):
        with transaction.atomic():
            summary = DocumentSummary.objects.select_for_update().get(id=summary_id)
            if summary.status == DocumentSummary.Status.COMPLETED and not force:
                return None
            if summary.status == DocumentSummary.Status.PROCESSING:
                return None
            summary.status = DocumentSummary.Status.PROCESSING
            summary.generation_attempts += 1
            summary.error_code = ""
            summary.error_message = ""
            summary.save(update_fields=["status", "generation_attempts", "error_code", "error_message", "updated_at"])
            return summary

    def mark_processing(self, summary, document, chunking):
        summary.model_name = getattr(self.client, "model", "") or settings.DOCUMENT_SUMMARY_MODEL or settings.OPENROUTER_MODEL
        summary.provider = getattr(self.client, "provider", "") or getattr(self.client, "PROVIDER", "openrouter")
        summary.source_character_count = len(document.extracted_text or "")
        summary.source_word_count = len(re.findall(r"\S+", document.extracted_text or ""))
        summary.chunk_count = len(chunking.chunks)
        summary.source_truncated = chunking.source_truncated
        summary.error_code = ""
        summary.error_message = ""
        summary.save(
            update_fields=[
                "model_name",
                "provider",
                "source_character_count",
                "source_word_count",
                "chunk_count",
                "source_truncated",
                "error_code",
                "error_message",
                "updated_at",
            ]
        )

    def defer_summary(self, summary):
        summary.status = DocumentSummary.Status.PENDING
        summary.error_code = "AI_QUOTA_DEFERRED"
        summary.error_message = ""
        summary.save(update_fields=["status", "error_code", "error_message", "updated_at"])

    def fail_summary(self, summary, code, message):
        summary.status = DocumentSummary.Status.FAILED
        summary.error_code = code
        summary.error_message = str(message or "Summary generation failed.")[:500]
        summary.save(update_fields=["status", "error_code", "error_message", "updated_at"])

    def map_ai_error(self, exc):
        if getattr(exc, "error_code", "") == "AI_TOKEN_BUDGET_EXCEEDED":
            return "AI_TOKEN_BUDGET_EXCEEDED"
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
        return ERROR_SUMMARY_GENERATION_FAILED

    def task_result(self, summary, cached=False):
        return {
            "status": summary.status,
            "document_id": str(summary.document_id),
            "summary_id": str(summary.id),
            "mode": summary.mode,
            "cached": cached,
            "error_code": summary.error_code,
        }

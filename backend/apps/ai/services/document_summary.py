import hashlib
import json
import re
from dataclasses import dataclass

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
    AIRateLimited,
    AIServiceError,
    AITimeout,
)
from apps.ai.services.prompt_builder import DocumentSummaryPromptBuilder


ERROR_EXTRACTION_NOT_READY = "EXTRACTION_NOT_READY"
ERROR_EXTRACTION_FAILED = "EXTRACTION_FAILED"
ERROR_NO_EXTRACTABLE_TEXT = "NO_EXTRACTABLE_TEXT"
ERROR_INVALID_AI_OUTPUT = "INVALID_AI_OUTPUT"
ERROR_SUMMARY_GENERATION_FAILED = "SUMMARY_GENERATION_FAILED"
PROMPT_VERSION = DocumentSummaryPromptBuilder.PROMPT_VERSION


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
            return ChunkingResult([DocumentChunk(1, source, 0, len(source))], source_truncated)

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
        return ChunkingResult(chunks, source_truncated)

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


class DocumentSummaryService:
    def __init__(self, client=None, chunker=None, prompt_builder=None, validator=None):
        self.client = client or AIClient(model=settings.DOCUMENT_SUMMARY_MODEL)
        self.chunker = chunker or DocumentChunker()
        self.prompt_builder = prompt_builder or DocumentSummaryPromptBuilder()
        self.validator = validator or DocumentSummaryOutputValidator()

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
            if checksum_changed and summary.status == DocumentSummary.Status.COMPLETED:
                summary.status = DocumentSummary.Status.STALE
                summary.save(update_fields=["status", "updated_at"])

            if (
                not force
                and summary.status == DocumentSummary.Status.COMPLETED
                and summary.input_checksum == checksum
            ):
                return SummaryRequestResult(summary, cached=True, should_enqueue=False, created=created)

            if (
                not created
                and not force
                and summary.status in {
                    DocumentSummary.Status.PENDING,
                    DocumentSummary.Status.PROCESSING,
                }
                and summary.input_checksum == checksum
            ):
                return SummaryRequestResult(summary, cached=False, should_enqueue=False, created=created)

            summary.status = DocumentSummary.Status.PENDING
            summary.input_checksum = checksum
            summary.content = "" if force or checksum_changed else summary.content
            summary.structured_content = {} if force or checksum_changed else summary.structured_content
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

    def generate(self, document_id, mode, force=False):
        document = StudyDocument.objects.get(pk=document_id)
        self.validate_document_ready(document)
        request = self.request_summary(document, mode, force=force)
        if request.cached and not force:
            return self.task_result(request.summary, cached=True)
        summary = request.summary

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
            structured = self.generate_structured_summary(mode, chunking.chunks)
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

    def generate_structured_summary(self, mode, chunks):
        if len(chunks) == 1:
            return self.call_and_validate(mode, chunks[0].text, phase="final")

        chunk_summaries = []
        for chunk in chunks:
            structured = self.call_and_validate(mode, chunk.text, phase="map")
            chunk_summaries.append(
                {
                    "chunk": chunk.index,
                    "summary": structured,
                }
            )
        reduce_source = json.dumps(
            {"chunk_summaries": chunk_summaries},
            ensure_ascii=False,
            sort_keys=True,
        )
        return self.call_and_validate(mode, reduce_source, phase="reduce")

    def call_and_validate(self, mode, source_text, phase):
        system_prompt, user_prompt = self.prompt_builder.build_messages(
            mode,
            source_text,
            phase=phase,
        )
        last_error = None
        for attempt in range(2):
            response = self.client.complete_json(
                system_prompt,
                user_prompt,
                operation="document_summary",
            )
            try:
                return self.validator.parse_and_validate(response["content"], mode)
            except AIInvalidResponse as exc:
                last_error = exc
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

    def mark_processing(self, summary, document, chunking):
        summary.status = DocumentSummary.Status.PROCESSING
        summary.generation_attempts += 1
        summary.model_name = settings.DOCUMENT_SUMMARY_MODEL or settings.OPENROUTER_MODEL
        summary.provider = getattr(self.client, "PROVIDER", "openrouter")
        summary.source_character_count = len(document.extracted_text or "")
        summary.source_word_count = len(re.findall(r"\S+", document.extracted_text or ""))
        summary.chunk_count = len(chunking.chunks)
        summary.source_truncated = chunking.source_truncated
        summary.error_code = ""
        summary.error_message = ""
        summary.save(
            update_fields=[
                "status",
                "generation_attempts",
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

    def fail_summary(self, summary, code, message):
        summary.status = DocumentSummary.Status.FAILED
        summary.error_code = code
        summary.error_message = str(message or "Summary generation failed.")[:500]
        summary.save(update_fields=["status", "error_code", "error_message", "updated_at"])

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

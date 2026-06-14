import hashlib
import uuid
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.ai.document_parsers import get_parser
from apps.ai.document_parsers.exceptions import (
    DocumentExtractionError,
    FileNotFoundError,
    FileTooLargeError,
)
from apps.ai.document_parsers.normalizer import count_words, normalize_text, truncate_text
from apps.ai.models import StudyDocument


PARSER_VERSION = "day19-v1"


def infer_file_type(filename):
    return Path(filename or "").suffix.lower().removeprefix(".")


def build_storage_filename(original_name, file_type):
    safe_stem = Path(original_name or "document").stem[:80] or "document"
    return f"{safe_stem}-{uuid.uuid4().hex[:12]}.{file_type}"


class DocumentExtractionService:
    def __init__(
        self,
        max_upload_size=None,
        max_extracted_characters=None,
    ):
        self.max_upload_size = (
            max_upload_size
            if max_upload_size is not None
            else settings.DOCUMENT_MAX_UPLOAD_SIZE_BYTES
        )
        self.max_extracted_characters = (
            max_extracted_characters
            if max_extracted_characters is not None
            else settings.DOCUMENT_MAX_EXTRACTED_CHARACTERS
        )

    def build_document_data_from_upload(self, uploaded_file):
        content = self.read_upload(uploaded_file)
        original_name = uploaded_file.name
        mime_type = getattr(uploaded_file, "content_type", "") or ""
        extraction = self.extract_content(
            content=content,
            filename=original_name,
            mime_type=mime_type,
        )
        uploaded_file.seek(0)
        file_type = extraction["file_type"]
        return {
            "filename": build_storage_filename(original_name, file_type),
            "original_name": original_name,
            "file_type": file_type,
            "file_size_bytes": len(content),
            "page_count": extraction["page_count"],
            "extracted_text": extraction["text"],
            "metadata": {"extraction": extraction["metadata"]},
        }

    def extract_document(
        self,
        document_or_id,
        content=None,
        filename=None,
        mime_type="",
        force=False,
    ):
        document = self.get_document(document_or_id)
        existing = (document.metadata or {}).get("extraction", {})

        if content is None:
            if document.extracted_text and not force:
                return {
                    "status": "completed",
                    "document_id": str(document.id),
                    "skipped": True,
                    "reason": "already_extracted",
                }
            self.mark_failed(document, FileNotFoundError())
            raise FileNotFoundError()

        content = self.ensure_bytes(content)
        checksum = self.checksum(content)
        if (
            not force
            and existing.get("checksum") == checksum
            and existing.get("status") in {"completed", "empty"}
        ):
            return {
                "status": existing["status"],
                "document_id": str(document.id),
                "skipped": True,
                "reason": "checksum_unchanged",
            }

        document.status = StudyDocument.Status.PROCESSING
        metadata = document.metadata or {}
        metadata["extraction"] = {
            **existing,
            "status": "processing",
            "checksum": checksum,
            "parser_version": PARSER_VERSION,
            "started_at": timezone.now().isoformat(),
        }
        document.metadata = metadata
        document.save(update_fields=["status", "metadata"])

        try:
            extraction = self.extract_content(
                content=content,
                filename=filename or document.original_name,
                mime_type=mime_type,
            )
        except DocumentExtractionError as exc:
            self.mark_failed(document, exc, checksum=checksum)
            raise

        self.save_extraction(document, extraction)
        return {
            "status": extraction["metadata"]["status"],
            "document_id": str(document.id),
            "skipped": False,
            "character_count": extraction["metadata"]["character_count"],
            "word_count": extraction["metadata"]["word_count"],
        }

    def read_upload(self, uploaded_file):
        size = getattr(uploaded_file, "size", None)
        if size is not None and size > self.max_upload_size:
            raise FileTooLargeError()
        content = uploaded_file.read()
        if len(content) > self.max_upload_size:
            raise FileTooLargeError()
        return content

    def extract_content(self, content, filename, mime_type=""):
        content = self.ensure_bytes(content)
        if len(content) > self.max_upload_size:
            raise FileTooLargeError()

        checksum = self.checksum(content)
        parser = get_parser(filename, mime_type=mime_type, content=content)
        result = parser.extract(content)
        normalized_text = normalize_text(result.text)
        truncated_text, truncated, original_count = truncate_text(
            normalized_text,
            self.max_extracted_characters,
        )
        character_count = len(truncated_text)
        metadata = {
            "status": "completed" if truncated_text else "empty",
            "error_code": "",
            "error_message": "",
            "checksum": checksum,
            "parser_version": PARSER_VERSION,
            "detected_file_type": result.detected_file_type or parser.file_type,
            "character_count": character_count,
            "original_character_count": original_count,
            "word_count": count_words(truncated_text),
            "truncated": truncated,
            "page_map": self.trim_page_map(result.page_map, character_count),
            "warnings": list(result.warnings or []),
            "completed_at": timezone.now().isoformat(),
        }
        return {
            "text": truncated_text,
            "file_type": parser.file_type,
            "page_count": result.page_count or 0,
            "metadata": metadata,
        }

    def save_extraction(self, document, extraction):
        with transaction.atomic():
            locked = StudyDocument.objects.select_for_update().get(pk=document.pk)
            metadata = locked.metadata or {}
            metadata["extraction"] = extraction["metadata"]
            locked.file_type = extraction["file_type"]
            locked.page_count = extraction["page_count"]
            locked.extracted_text = extraction["text"]
            locked.status = StudyDocument.Status.READY
            locked.processed_at = timezone.now()
            locked.metadata = metadata
            locked.save(
                update_fields=[
                    "file_type",
                    "page_count",
                    "extracted_text",
                    "status",
                    "processed_at",
                    "metadata",
                ]
            )

    def mark_failed(self, document, exc, checksum=""):
        metadata = document.metadata or {}
        extraction = metadata.get("extraction", {})
        extraction.update(
            {
                "status": "failed",
                "error_code": exc.error_code,
                "error_message": exc.safe_message,
                "checksum": checksum or extraction.get("checksum", ""),
                "parser_version": PARSER_VERSION,
                "failed_at": timezone.now().isoformat(),
            }
        )
        metadata["extraction"] = extraction
        document.status = StudyDocument.Status.ERROR
        document.processed_at = timezone.now()
        document.metadata = metadata
        document.save(update_fields=["status", "processed_at", "metadata"])

    def trim_page_map(self, page_map, character_count):
        trimmed = []
        for item in page_map or []:
            start = min(int(item.get("start_char", 0)), character_count)
            end = min(int(item.get("end_char", start)), character_count)
            safe_item = {
                key: value
                for key, value in item.items()
                if key in {"page", "section", "type", "character_count"}
            }
            safe_item["start_char"] = start
            safe_item["end_char"] = end
            safe_item["character_count"] = max(0, end - start)
            trimmed.append(safe_item)
        return trimmed

    def get_document(self, document_or_id):
        if isinstance(document_or_id, StudyDocument):
            return document_or_id
        return StudyDocument.objects.get(pk=document_or_id)

    def ensure_bytes(self, content):
        if isinstance(content, bytes):
            return content
        if hasattr(content, "read"):
            return content.read()
        return bytes(content)

    def checksum(self, content):
        return hashlib.sha256(content).hexdigest()

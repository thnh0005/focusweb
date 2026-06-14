import re

from django.conf import settings

from apps.ai.document_parsers.exceptions import DocumentExtractionError
from apps.ai.services.document_extraction import (
    DocumentExtractionService,
    build_storage_filename,
    infer_file_type,
)


ALLOWED_DOCUMENT_TYPES = {"pdf", "docx", "txt"}
MAX_EXTRACTED_TEXT_LENGTH = settings.DOCUMENT_MAX_EXTRACTED_CHARACTERS


def extract_document_metadata(uploaded_file):
    try:
        return DocumentExtractionService().build_document_data_from_upload(uploaded_file)
    except DocumentExtractionError as exc:
        raise ValueError(exc.safe_message) from exc


def text_chunks_for_flashcards(text, quantity):
    sentences = [
        item.strip()
        for item in re.split(r"(?<=[.!?])\s+|\n+", text or "")
        if item.strip()
    ]
    if not sentences:
        sentences = ["Review the main ideas from this document."]
    return sentences[: max(1, quantity)]

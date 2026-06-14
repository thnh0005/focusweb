import re
from io import BytesIO

from .base import BaseDocumentParser, ExtractionResult
from .exceptions import EncryptedPDFError, FileTypeMismatchError, InvalidPDFError


class PDFParser(BaseDocumentParser):
    file_type = "pdf"
    extensions = {".pdf"}
    mime_types = {"", "application/pdf", "application/octet-stream"}

    def validate_signature(self, content):
        if not content.startswith(b"%PDF-"):
            raise FileTypeMismatchError()
        if b"/Encrypt" in content[:4096] or b"/Encrypt" in content[-4096:]:
            raise EncryptedPDFError()
        return True

    def extract(self, content):
        self.validate_signature(content)
        try:
            return self.extract_with_pypdf(content)
        except ImportError:
            return self.extract_with_fallback(content)

    def extract_with_pypdf(self, content):
        from pypdf import PdfReader
        from pypdf.errors import PdfReadError

        try:
            reader = PdfReader(BytesIO(content))
        except PdfReadError as exc:
            raise InvalidPDFError() from exc
        if reader.is_encrypted:
            raise EncryptedPDFError()

        page_texts = []
        warnings = []
        for index, page in enumerate(reader.pages, start=1):
            try:
                page_texts.append(page.extract_text() or "")
            except Exception:
                warnings.append(f"PAGE_{index}_EXTRACTION_FAILED")
                page_texts.append("")
        return self.result_from_pages(page_texts, warnings)

    def extract_with_fallback(self, content):
        if b"%%EOF" not in content[-2048:]:
            raise InvalidPDFError()
        raw = content.decode("latin-1", errors="ignore")
        chunks = re.split(r"/Type\s*/Page\b", raw)
        if len(chunks) <= 1:
            chunks = [raw]
        page_texts = [self.literal_text(chunk) for chunk in chunks[1:] or chunks]
        return self.result_from_pages(page_texts, [])

    def literal_text(self, raw):
        matches = re.findall(r"\(([^()]*)\)\s*Tj", raw)
        matches += [
            item
            for array in re.findall(r"\[(.*?)\]\s*TJ", raw, flags=re.DOTALL)
            for item in re.findall(r"\(([^()]*)\)", array)
        ]
        cleaned = [item.replace("\\n", " ").replace("\\(", "(").replace("\\)", ")") for item in matches]
        return " ".join(item.strip() for item in cleaned if item.strip())

    def result_from_pages(self, page_texts, warnings):
        parts = []
        page_map = []
        cursor = 0
        for index, page_text in enumerate(page_texts, start=1):
            text = page_text.strip()
            if parts:
                parts.append("\n\n")
                cursor += 2
            start = cursor
            parts.append(text)
            cursor += len(text)
            page_map.append(
                {
                    "page": index,
                    "start_char": start,
                    "end_char": cursor,
                    "character_count": len(text),
                }
            )
        return ExtractionResult(
            text="".join(parts),
            page_count=len(page_texts),
            page_map=page_map,
            detected_file_type=self.file_type,
            warnings=warnings,
        )


from .base import BaseDocumentParser, ExtractionResult
from .exceptions import BinaryTextFileError, FileTypeMismatchError, TextEncodingError


class TXTParser(BaseDocumentParser):
    file_type = "txt"
    extensions = {".txt"}
    mime_types = {"", "text/plain", "application/octet-stream"}

    def validate_signature(self, content):
        sample = content[:4096]
        if b"\x00" in sample:
            raise BinaryTextFileError()
        if sample and sum(byte < 9 for byte in sample) / len(sample) > 0.05:
            raise BinaryTextFileError()
        return True

    def extract(self, content):
        self.validate_signature(content)
        text = None
        for encoding in ("utf-8-sig", "utf-8", "cp1258"):
            try:
                text = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        if text is None:
            raise TextEncodingError()
        if text.startswith("%PDF-") or text[:2] == "PK":
            raise FileTypeMismatchError()
        return ExtractionResult(
            text=text,
            page_count=None,
            page_map=[
                {
                    "section": 1,
                    "type": "text",
                    "start_char": 0,
                    "end_char": len(text),
                    "character_count": len(text),
                }
            ]
            if text
            else [],
            detected_file_type=self.file_type,
        )


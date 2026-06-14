from dataclasses import dataclass, field


@dataclass
class ExtractionResult:
    text: str
    page_count: int | None
    page_map: list[dict] = field(default_factory=list)
    character_count: int = 0
    original_character_count: int = 0
    word_count: int = 0
    detected_file_type: str = ""
    truncated: bool = False
    warnings: list[str] = field(default_factory=list)


class BaseDocumentParser:
    file_type = ""
    extensions: set[str] = set()
    mime_types: set[str] = set()

    def supports(self, extension, mime_type=""):
        mime_type = (mime_type or "").split(";")[0].strip().lower()
        return extension.lower() in self.extensions and (
            not mime_type or mime_type in self.mime_types
        )

    def validate_signature(self, content):
        raise NotImplementedError

    def extract(self, content):
        raise NotImplementedError

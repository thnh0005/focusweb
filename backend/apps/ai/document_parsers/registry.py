from pathlib import Path

from .docx_parser import DOCXParser
from .exceptions import FileTypeMismatchError, UnsupportedFileTypeError
from .pdf_parser import PDFParser
from .txt_parser import TXTParser


PARSERS = [PDFParser(), DOCXParser(), TXTParser()]


def extension_for_name(filename):
    return Path(filename or "").suffix.lower()


def get_parser(filename, mime_type="", content=None):
    extension = extension_for_name(filename)
    mime_type = (mime_type or "").split(";")[0].strip().lower()
    parser = next(
        (candidate for candidate in PARSERS if extension in candidate.extensions),
        None,
    )
    if parser is None:
        raise UnsupportedFileTypeError()
    if mime_type and mime_type not in parser.mime_types:
        raise FileTypeMismatchError()
    if content is not None:
        parser.validate_signature(content)
    return parser

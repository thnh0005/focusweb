import re
import uuid
import zipfile
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree


ALLOWED_DOCUMENT_TYPES = {"pdf", "docx", "txt"}
MAX_EXTRACTED_TEXT_LENGTH = 50000


def infer_file_type(filename):
    return Path(filename or "").suffix.lower().removeprefix(".")


def build_storage_filename(original_name, file_type):
    safe_stem = Path(original_name or "document").stem[:80] or "document"
    return f"{safe_stem}-{uuid.uuid4().hex[:12]}.{file_type}"


def extract_document_metadata(uploaded_file):
    """Trích metadata đủ dùng cho Dev1 mà không cần lưu binary file."""
    original_name = uploaded_file.name
    file_type = infer_file_type(original_name)
    if file_type not in ALLOWED_DOCUMENT_TYPES:
        raise ValueError("Only PDF, DOCX, and TXT files are supported.")

    content = uploaded_file.read()
    uploaded_file.seek(0)
    text = extract_text(file_type, content)
    return {
        "filename": build_storage_filename(original_name, file_type),
        "original_name": original_name,
        "file_type": file_type,
        "file_size_bytes": uploaded_file.size,
        "page_count": estimate_page_count(file_type, content, text),
        "extracted_text": text[:MAX_EXTRACTED_TEXT_LENGTH],
        "metadata": {
            "parser": "stdlib-fallback",
            "textLength": len(text),
        },
    }


def extract_text(file_type, content):
    if file_type == "txt":
        return decode_text(content)
    if file_type == "docx":
        return extract_docx_text(content)
    if file_type == "pdf":
        return extract_pdf_text(content)
    return ""


def decode_text(content):
    for encoding in ("utf-8", "utf-16", "cp1258", "latin-1"):
        try:
            return content.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="ignore").strip()


def extract_docx_text(content):
    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            xml = archive.read("word/document.xml")
    except (KeyError, zipfile.BadZipFile):
        return ""

    root = ElementTree.fromstring(xml)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for paragraph in root.findall(".//w:p", namespace):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace))
        if text.strip():
            paragraphs.append(text.strip())
    return "\n".join(paragraphs)


def extract_pdf_text(content):
    # PDF parsing sâu thuộc phần tối ưu sau; fallback này lấy text literal đơn giản.
    raw = content.decode("latin-1", errors="ignore")
    matches = re.findall(r"\(([^()]{3,})\)", raw)
    cleaned = [item.replace("\\n", " ").strip() for item in matches]
    return "\n".join(item for item in cleaned if item)


def estimate_page_count(file_type, content, text):
    if file_type == "pdf":
        return max(1, content.count(b"/Type /Page"))
    if file_type == "docx":
        return max(1, text.count("\f") + 1) if text else 0
    if file_type == "txt":
        line_count = max(1, len(text.splitlines()))
        return max(1, (line_count + 39) // 40)
    return 0


def text_chunks_for_flashcards(text, quantity):
    sentences = [
        item.strip()
        for item in re.split(r"(?<=[.!?])\s+|\n+", text or "")
        if item.strip()
    ]
    if not sentences:
        sentences = ["Review the main ideas from this document."]
    return sentences[: max(1, quantity)]

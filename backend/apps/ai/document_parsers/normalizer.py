import re
import unicodedata


CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
BLANK_LINES = re.compile(r"\n{3,}")


def normalize_text(text):
    text = unicodedata.normalize("NFC", text or "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = CONTROL_CHARS.sub("", text)
    lines = [line.rstrip() for line in text.split("\n")]
    text = "\n".join(lines).strip()
    return BLANK_LINES.sub("\n\n", text)


def count_words(text):
    return len(re.findall(r"\S+", text or ""))


def truncate_text(text, max_characters):
    original_count = len(text)
    if original_count <= max_characters:
        return text, False, original_count

    candidate = text[:max_characters]
    boundary = max(candidate.rfind("\n\n"), candidate.rfind("\n"), candidate.rfind(" "))
    if boundary >= int(max_characters * 0.8):
        candidate = candidate[:boundary]
    return candidate.rstrip(), True, original_count


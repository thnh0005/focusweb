import json
import re

from .exceptions import AIInvalidResponse


CLASSIFICATION_RELEVANT = "RELEVANT"
CLASSIFICATION_UNCERTAIN = "UNCERTAIN"
CLASSIFICATION_NOT_RELEVANT = "NOT_RELEVANT"


def clamp_number(value, minimum, maximum, default=0):
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = default
    return max(minimum, min(maximum, number))


def classify_relevance(score: int) -> str:
    if score >= 70:
        return CLASSIFICATION_RELEVANT
    if score >= 40:
        return CLASSIFICATION_UNCERTAIN
    return CLASSIFICATION_NOT_RELEVANT


class SemanticAIResponseParser:
    CODE_FENCE_PATTERN = re.compile(
        r"^\s*```(?:json)?\s*(?P<body>.*?)\s*```\s*$",
        re.IGNORECASE | re.DOTALL,
    )

    def parse(self, content) -> dict:
        if isinstance(content, dict):
            payload = content
        elif isinstance(content, str):
            payload = self.parse_json_text(content)
        else:
            raise AIInvalidResponse("AI response must be JSON text or object.")

        score = round(clamp_number(payload.get("relevance_score"), 0, 100, 0))
        confidence = clamp_number(payload.get("confidence"), 0, 1, 0)
        reason = str(payload.get("reason") or "").strip()[:160]
        classification = classify_relevance(score)

        return {
            "relevance_score": score,
            "classification": classification,
            "is_relevant": classification == CLASSIFICATION_RELEVANT,
            "confidence": confidence,
            "reason": reason,
        }

    def parse_json_text(self, text: str) -> dict:
        cleaned = text.strip()
        match = self.CODE_FENCE_PATTERN.match(cleaned)
        if match:
            cleaned = match.group("body").strip()

        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise AIInvalidResponse("AI response was not valid JSON.") from exc

        if not isinstance(payload, dict):
            raise AIInvalidResponse("AI response JSON must be an object.")
        return payload


class SessionInsightResponseParser:
    MAX_OBSERVATIONS = 4
    MAX_OBSERVATION_LENGTH = 240

    def parse(self, content) -> list[str]:
        payload = self.parse_payload(content)
        observations = payload.get("observations")
        if not isinstance(observations, list):
            raise AIInvalidResponse("AI response must include observations list.")

        cleaned = []
        for observation in observations:
            text = str(observation or "").strip()
            if not text:
                continue
            if len(text) > self.MAX_OBSERVATION_LENGTH:
                text = text[: self.MAX_OBSERVATION_LENGTH].rstrip()
            cleaned.append(text)
            if len(cleaned) >= self.MAX_OBSERVATIONS:
                break

        if not cleaned:
            raise AIInvalidResponse("AI response did not include observations.")
        return cleaned

    def parse_payload(self, content) -> dict:
        return SemanticAIResponseParser().parse_json_text(content) if isinstance(
            content,
            str,
        ) else self.validate_object(content)

    @staticmethod
    def validate_object(content) -> dict:
        if not isinstance(content, dict):
            raise AIInvalidResponse("AI response must be JSON text or object.")
        return content

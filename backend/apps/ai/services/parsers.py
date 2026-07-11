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


class SessionEndAnalysisResponseParser:
    ALLOWED_FOCUS_LEVELS = {"EXCELLENT", "GOOD", "FAIR", "POOR"}
    ALLOWED_SEVERITIES = {"LOW", "MEDIUM", "HIGH"}
    MAX_ITEMS = 8
    MAX_TEXT_LENGTH = 240

    def parse(self, content) -> dict:
        payload = self.parse_payload(content)

        score = round(clamp_number(payload.get("focus_score"), 0, 100, 0))
        focus_level = str(payload.get("focus_level") or "").strip().upper()
        if focus_level not in self.ALLOWED_FOCUS_LEVELS:
            focus_level = self.focus_level_for_score(score)

        summary = self.truncate(payload.get("summary"), self.MAX_TEXT_LENGTH)
        if not summary:
            summary = "The session was completed with focus signals recorded."

        main_distractions = []
        for item in self.ensure_list(payload.get("main_distractions")):
            if not isinstance(item, dict):
                continue
            severity = str(item.get("severity") or "").strip().upper()
            if severity not in self.ALLOWED_SEVERITIES:
                severity = "LOW"
            domain = self.truncate(item.get("domain"), 120)
            reason = self.truncate(item.get("reason"), self.MAX_TEXT_LENGTH)
            if domain or reason:
                main_distractions.append(
                    {
                        "domain": domain,
                        "reason": reason,
                        "severity": severity,
                    }
                )
            if len(main_distractions) >= self.MAX_ITEMS:
                break

        tab_switch_payload = payload.get("tab_switch_analysis")
        if not isinstance(tab_switch_payload, dict):
            tab_switch_payload = {}
        total_switches = round(
            clamp_number(tab_switch_payload.get("total_switches"), 0, 100000, 0)
        )
        tab_switch_analysis = {
            "total_switches": total_switches,
            "assessment": self.truncate(
                tab_switch_payload.get("assessment"),
                self.MAX_TEXT_LENGTH,
            ),
        }

        return {
            "focus_score": score,
            "focus_level": focus_level,
            "summary": summary,
            "main_distractions": main_distractions,
            "productive_sites": self.clean_string_list(payload.get("productive_sites")),
            "tab_switch_analysis": tab_switch_analysis,
            "timeline_observations": self.clean_string_list(
                payload.get("timeline_observations")
            ),
            "recommendations": self.clean_string_list(payload.get("recommendations")),
        }

    def parse_payload(self, content) -> dict:
        return (
            SemanticAIResponseParser().parse_json_text(content)
            if isinstance(content, str)
            else SessionInsightResponseParser.validate_object(content)
        )

    def clean_string_list(self, value) -> list[str]:
        cleaned = []
        for item in self.ensure_list(value):
            text = self.truncate(item, self.MAX_TEXT_LENGTH)
            if text:
                cleaned.append(text)
            if len(cleaned) >= self.MAX_ITEMS:
                break
        return cleaned

    @staticmethod
    def ensure_list(value) -> list:
        return value if isinstance(value, list) else []

    @staticmethod
    def truncate(value, limit: int) -> str:
        return str(value or "").replace("\n", " ").replace("\r", " ").strip()[:limit]

    @staticmethod
    def focus_level_for_score(score: int) -> str:
        if score >= 85:
            return "EXCELLENT"
        if score >= 70:
            return "GOOD"
        if score >= 50:
            return "FAIR"
        return "POOR"

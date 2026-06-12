from urllib.parse import urlparse

from apps.ai.models import AIAnalysisResult
from apps.sessions.models import FocusSession

from .ai_client import AIClient
from .exceptions import AIServiceError
from .exceptions import AIUnknownError
from .observability import log_ai_event
from .parsers import (
    CLASSIFICATION_NOT_RELEVANT,
    CLASSIFICATION_RELEVANT,
    CLASSIFICATION_UNCERTAIN,
    SemanticAIResponseParser,
)
from .prompt_builder import PromptBuilder


class SemanticAnalysisService:
    TITLE_LIMIT = 500
    META_LIMIT = 500
    SNIPPET_LIMIT = 500

    FOCUS_STATE_BY_CLASSIFICATION = {
        CLASSIFICATION_RELEVANT: AIAnalysisResult.FocusState.FOCUSED,
        CLASSIFICATION_UNCERTAIN: AIAnalysisResult.FocusState.POTENTIALLY_DISTRACTED,
        CLASSIFICATION_NOT_RELEVANT: AIAnalysisResult.FocusState.DISTRACTED,
    }

    def __init__(
        self,
        client: AIClient | None = None,
        prompt_builder: PromptBuilder | None = None,
        parser: SemanticAIResponseParser | None = None,
    ):
        self.client = client or AIClient()
        self.prompt_builder = prompt_builder or PromptBuilder()
        self.parser = parser or SemanticAIResponseParser()

    def analyze_event_safe(self, user, session, browser_event) -> dict:
        try:
            return self.analyze_event(user, session, browser_event)
        except AIServiceError as exc:
            log_ai_event(
                "ai_semantic_fallback",
                operation="semantic",
                provider=getattr(exc, "provider", AIClient.PROVIDER),
                session_id=getattr(session, "id", None),
                event_id=getattr(browser_event, "id", None),
                error_code=exc.error_code,
                retryable=exc.retryable,
                fallback_applied=True,
            )
            return {
                "status": "error",
                "available": False,
                "relevance_score": None,
                "classification": None,
                "confidence": None,
                "error_code": exc.error_code,
                "source": "UNAVAILABLE",
            }

    def analyze_event(self, user, session, browser_event) -> dict:
        eligibility = self.get_ineligibility_reason(user, session, browser_event)
        if eligibility:
            return {
                "status": "skipped",
                "reason": eligibility,
                "source": "semantic_ai",
            }

        existing = AIAnalysisResult.objects.filter(
            session_id=session.id,
            browser_event_id=browser_event.id,
        ).first()
        if existing:
            return self.serialize_result(existing, status="existing")

        normalized = self.normalize_input(
            goal=session.goal,
            title=browser_event.page_title,
            meta=browser_event.meta_description,
            snippet=browser_event.content_snippet,
            domain=browser_event.domain or browser_event.url,
        )
        system_prompt, user_prompt = self.prompt_builder.build_relevance_messages(
            goal=normalized["goal"],
            title=normalized["title"],
            meta=normalized["meta"],
            snippet=normalized["snippet"],
            domain=normalized["domain"],
        )
        try:
            provider_result = self.client.complete_json(
                system_prompt,
                user_prompt,
                operation="semantic",
            )
            parsed = self.parser.parse(provider_result["content"])
        except AIServiceError:
            raise
        except Exception as exc:
            raise AIUnknownError(
                "AI semantic analysis failed unexpectedly.",
                provider=AIClient.PROVIDER,
                operation="semantic",
            ) from exc
        analysis = AIAnalysisResult.objects.create(
            session_id=session.id,
            browser_event_id=browser_event.id,
            provider=provider_result.get("source", ""),
            model_name=provider_result.get("model", ""),
            session_goal=normalized["goal"],
            page_title=normalized["title"],
            domain=normalized["domain"],
            content_snippet=normalized["snippet"],
            relevance_score=parsed["relevance_score"],
            is_relevant=parsed["is_relevant"],
            focus_state=self.FOCUS_STATE_BY_CLASSIFICATION[parsed["classification"]],
            reason=parsed["reason"],
            raw_response={
                "classification": parsed["classification"],
                "confidence": parsed["confidence"],
            },
            latency_ms=provider_result.get("latency_ms"),
        )
        return self.serialize_result(analysis, status="ok")

    def get_ineligibility_reason(self, user, session, browser_event) -> str:
        if user is None or session is None or browser_event is None:
            return "missing_context"
        if getattr(session, "user_id", None) != getattr(user, "pk", None):
            return "session_owner_mismatch"
        if getattr(browser_event, "session_id", None) != getattr(session, "id", None):
            return "event_session_mismatch"
        if str(getattr(session, "status", "")).lower() != FocusSession.Status.ACTIVE:
            return "session_not_active"
        if getattr(session, "mode", "") != FocusSession.Mode.DEEP_WORK:
            return "session_not_deep_work"
        if not str(getattr(session, "goal", "") or "").strip():
            return "missing_goal"
        return ""

    def normalize_input(self, goal, title="", meta="", snippet="", domain="") -> dict:
        return {
            "goal": self.truncate(goal, self.TITLE_LIMIT),
            "title": self.truncate(title, self.TITLE_LIMIT),
            "meta": self.truncate(meta, self.META_LIMIT),
            "snippet": self.truncate(snippet, self.SNIPPET_LIMIT),
            "domain": self.normalize_domain(domain),
        }

    def serialize_result(self, analysis: AIAnalysisResult, status="ok") -> dict:
        classification = analysis.raw_response.get(
            "classification",
            self.classification_from_focus_state(analysis.focus_state),
        )
        confidence = analysis.raw_response.get("confidence", 0)
        return {
            "status": status,
            "available": True,
            "analysis_id": str(analysis.id),
            "relevance_score": round(analysis.relevance_score),
            "classification": classification,
            "is_relevant": analysis.is_relevant,
            "confidence": confidence,
            "reason": analysis.reason,
            "source": analysis.provider,
            "model": analysis.model_name,
            "latency_ms": analysis.latency_ms,
        }

    @staticmethod
    def classification_from_focus_state(focus_state: str) -> str:
        if focus_state == AIAnalysisResult.FocusState.FOCUSED:
            return CLASSIFICATION_RELEVANT
        if focus_state == AIAnalysisResult.FocusState.POTENTIALLY_DISTRACTED:
            return CLASSIFICATION_UNCERTAIN
        return CLASSIFICATION_NOT_RELEVANT

    @staticmethod
    def truncate(value, limit: int) -> str:
        return str(value or "").strip()[:limit]

    @staticmethod
    def normalize_domain(value) -> str:
        raw_value = str(value or "").strip().lower()
        if not raw_value:
            return ""
        parsed = urlparse(raw_value if "://" in raw_value else f"https://{raw_value}")
        domain = parsed.hostname or parsed.netloc or parsed.path.split("/", maxsplit=1)[0]
        return domain.removeprefix("www.").strip(".")

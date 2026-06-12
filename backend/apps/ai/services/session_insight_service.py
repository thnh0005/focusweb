from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Count, Min, Sum
from django.utils import timezone

from apps.ai.models import AIAnalysisResult, SessionInsight
from apps.scoring.models import FocusScore, ScoreComponent
from apps.scoring.realtime_score import RealtimeScoreCalculator
from apps.sessions.models import FocusSession
from apps.tracking.models import BrowserEvent, WarningEvent

from .ai_client import AIClient
from .exceptions import (
    AIInvalidResponse,
    AIAuthError,
    AICircuitOpen,
    AINotConfigured,
    AIProviderError,
    AIProviderUnavailable,
    AIRateLimited,
    AIServiceError,
    AITimeout,
    AIUnknownError,
)
from .observability import log_ai_event
from .parsers import SessionInsightResponseParser
from .prompt_builder import PromptBuilder


ERROR_SESSION_NOT_ELIGIBLE = "SESSION_NOT_ELIGIBLE"
ERROR_INSUFFICIENT_SESSION_DATA = "INSUFFICIENT_SESSION_DATA"
ERROR_ALREADY_PROCESSING = "INSIGHT_ALREADY_PROCESSING"
ERROR_ALREADY_COMPLETED = "INSIGHT_ALREADY_COMPLETED"
ERROR_RETRY_LIMIT_REACHED = "RETRY_LIMIT_REACHED"

TRANSIENT_AI_ERRORS = (AITimeout, AIRateLimited, AIProviderUnavailable)


class SessionInsightConflict(Exception):
    def __init__(self, error_code: str, message: str):
        super().__init__(message)
        self.error_code = error_code
        self.message = message


class SessionInsightValidationError(Exception):
    def __init__(self, error_code: str, message: str):
        super().__init__(message)
        self.error_code = error_code
        self.message = message


class SessionInsightDataAggregator:
    def aggregate(self, session: FocusSession) -> dict:
        events = list(
            BrowserEvent.objects.filter(session_id=session.id)
            .order_by("created_at")
            .values("active_seconds", "idle_seconds", "tab_switch_count")
        )
        event_stats = BrowserEvent.objects.filter(session_id=session.id).aggregate(
            event_count=Count("id"),
            total_idle_seconds=Sum("idle_seconds"),
        )
        tab_switch_count = RealtimeScoreCalculator().aggregate_counter(
            events,
            "tab_switch_count",
        )
        warning_count = WarningEvent.objects.filter(session_id=session.id).count()
        focus_score = self.serialize_focus_score(session)
        relevance_stats = self.relevance_stats(session)
        decision_stats = self.decision_stats(session)

        return {
            "session": {
                "mode": session.mode,
                "goal": session.goal,
                "target_duration_minutes": self.seconds_to_minutes(
                    session.target_duration_seconds,
                ),
                "actual_duration_minutes": self.seconds_to_minutes(
                    session.actual_duration_seconds,
                ),
                "completion_status": session.status,
            },
            "focus_score": focus_score,
            "behavior": {
                "event_count": event_stats["event_count"] or 0,
                "tab_switch_count": tab_switch_count,
                "total_idle_seconds": event_stats["total_idle_seconds"] or 0,
                "warning_count": warning_count,
                "distracted_event_count": relevance_stats["distracted_event_count"],
                "potentially_distracted_event_count": relevance_stats[
                    "potentially_distracted_event_count"
                ],
            },
            "trends": {
                "average_relevance_score": relevance_stats[
                    "average_relevance_score"
                ],
                "lowest_relevance_score": relevance_stats["lowest_relevance_score"],
                "relevance_declined_near_end": relevance_stats[
                    "relevance_declined_near_end"
                ],
            },
            "hybrid_decision": decision_stats,
        }

    def serialize_focus_score(self, session: FocusSession) -> dict:
        try:
            score = (
                FocusScore.objects.prefetch_related("components")
                .filter(session=session)
                .get()
            )
        except FocusScore.DoesNotExist:
            return {
                "overall": session.focus_score,
                "label": session.focus_state or None,
                "content_relevance": None,
                "focus_continuity": None,
                "tab_stability": None,
                "distraction_control": None,
            }

        components = {component.key: component.value for component in score.components.all()}
        return {
            "overall": score.total_score,
            "label": score.focus_state,
            "content_relevance": components.get(ScoreComponent.Key.CONTENT_RELEVANCE),
            "focus_continuity": components.get(ScoreComponent.Key.FOCUS_CONTINUITY),
            "tab_stability": components.get(ScoreComponent.Key.TAB_STABILITY),
            "distraction_control": components.get(
                ScoreComponent.Key.DISTRACTION_PENALTY,
            ),
        }

    def relevance_stats(self, session: FocusSession) -> dict:
        analyses = AIAnalysisResult.objects.filter(
            session_id=session.id,
            error_message="",
        )
        stats = analyses.aggregate(
            average_relevance_score=Avg("relevance_score"),
            lowest_relevance_score=Min("relevance_score"),
        )
        focused_counts = analyses.values("focus_state").annotate(count=Count("id"))
        counts = {item["focus_state"]: item["count"] for item in focused_counts}

        ordered_scores = list(
            analyses.order_by("created_at").values_list("relevance_score", flat=True)
        )
        declined = False
        if len(ordered_scores) >= 2:
            midpoint = max(1, len(ordered_scores) // 2)
            first = ordered_scores[:midpoint]
            last = ordered_scores[midpoint:]
            if last:
                declined = (sum(last) / len(last)) < (sum(first) / len(first)) - 10

        return {
            "average_relevance_score": self.round_or_none(
                stats["average_relevance_score"],
            ),
            "lowest_relevance_score": self.round_or_none(
                stats["lowest_relevance_score"],
            ),
            "relevance_declined_near_end": declined,
            "distracted_event_count": counts.get(
                AIAnalysisResult.FocusState.DISTRACTED,
                0,
            ),
            "potentially_distracted_event_count": counts.get(
                AIAnalysisResult.FocusState.POTENTIALLY_DISTRACTED,
                0,
            ),
        }

    def decision_stats(self, session: FocusSession) -> dict:
        warnings = WarningEvent.objects.filter(session_id=session.id)
        decision_counts = warnings.exclude(decision_state="").values(
            "decision_state",
        ).annotate(count=Count("id"))
        return {
            "warning_decision_state_counts": {
                item["decision_state"]: item["count"] for item in decision_counts
            },
            "average_warning_decision_score": self.round_or_none(
                warnings.aggregate(value=Avg("decision_score"))["value"],
            ),
        }

    @staticmethod
    def seconds_to_minutes(seconds) -> int:
        return round(max(0, int(seconds or 0)) / 60)

    @staticmethod
    def round_or_none(value):
        return round(value) if value is not None else None


class RuleBasedSessionInsightFallback:
    MAX_OBSERVATIONS = 4

    def build(self, payload: dict) -> list[str]:
        focus = payload.get("focus_score") or {}
        behavior = payload.get("behavior") or {}
        session = payload.get("session") or {}
        observations = []

        relevance = focus.get("content_relevance")
        if relevance is None:
            relevance = (payload.get("trends") or {}).get("average_relevance_score")
        if relevance is not None and relevance >= 75:
            observations.append(
                "The viewed content generally stayed aligned with the session goal.",
            )
        elif relevance is not None and relevance < 50:
            observations.append(
                "Some content during the session was not closely related to the stated goal.",
            )

        continuity = focus.get("focus_continuity")
        if continuity is not None and continuity < 60:
            observations.append(
                "The session included some interruption or idle time that may have affected continuity.",
            )

        tab_stability = focus.get("tab_stability")
        if tab_stability is not None and tab_stability < 70:
            observations.append(
                "Tab switching was relatively frequent during the session.",
            )

        if behavior.get("warning_count", 0) >= 2:
            observations.append(
                "The session recorded multiple focus warnings.",
            )

        target = session.get("target_duration_minutes") or 0
        actual = session.get("actual_duration_minutes") or 0
        if target > 0 and actual < target * 0.75:
            observations.append(
                "The session ended notably earlier than the planned duration.",
            )

        if not observations:
            observations.append(
                "The session was completed with the available focus metrics recorded.",
            )
        return observations[: self.MAX_OBSERVATIONS]


class SessionInsightService:
    COMPLETED_STATUSES = {FocusSession.Status.COMPLETED}

    def __init__(
        self,
        client: AIClient | None = None,
        prompt_builder: PromptBuilder | None = None,
        parser: SessionInsightResponseParser | None = None,
        aggregator: SessionInsightDataAggregator | None = None,
        fallback: RuleBasedSessionInsightFallback | None = None,
    ):
        self.client = client or AIClient(max_retries=0)
        self.prompt_builder = prompt_builder or PromptBuilder()
        self.parser = parser or SessionInsightResponseParser()
        self.aggregator = aggregator or SessionInsightDataAggregator()
        self.fallback = fallback or RuleBasedSessionInsightFallback()

    def is_session_eligible(self, session: FocusSession) -> bool:
        return session.status in self.COMPLETED_STATUSES

    def generate(self, session_id, defer_transient_retry=False) -> dict:
        session = FocusSession.objects.select_related("user").filter(pk=session_id).first()
        if session is None:
            return {"status": "skipped", "error_code": ERROR_SESSION_NOT_ELIGIBLE}
        if not self.is_session_eligible(session):
            insight = self.get_or_create_insight(session)
            self.mark_failed(
                insight,
                ERROR_SESSION_NOT_ELIGIBLE,
                "Session is not eligible for AI insight generation.",
            )
            return self.serialize(insight)

        insight = self.begin_processing(session)
        if insight.status == SessionInsight.Status.COMPLETED:
            return self.serialize(insight)
        if insight.status != SessionInsight.Status.PROCESSING:
            return self.serialize(insight)

        payload = self.aggregator.aggregate(session)
        try:
            observations, model_name = self.generate_ai_observations(payload)
            self.mark_completed(
                insight,
                observations=observations,
                source=SessionInsight.Source.AI,
                model_name=model_name,
            )
        except TRANSIENT_AI_ERRORS as exc:
            if defer_transient_retry:
                self.mark_pending_for_automatic_retry(insight, exc)
                raise
            self.complete_with_fallback(insight, payload, exc)
        except (
            AIAuthError,
            AICircuitOpen,
            AINotConfigured,
            AIInvalidResponse,
            AIProviderError,
            AIUnknownError,
            AIServiceError,
        ) as exc:
            self.complete_with_fallback(insight, payload, exc)
        except Exception as exc:
            observations = self.fallback.build(payload)
            if observations:
                self.mark_completed(
                    insight,
                    observations=observations,
                    source=SessionInsight.Source.RULE_BASED_FALLBACK,
                    model_name="",
                    error_code=ERROR_INSUFFICIENT_SESSION_DATA,
                    error_message="Session insight used fallback after internal processing failed.",
                )
            else:
                self.mark_failed(
                    insight,
                    ERROR_INSUFFICIENT_SESSION_DATA,
                    "Session insight could not be generated.",
                )
            return self.serialize(insight)
        return self.serialize(insight)

    def generate_ai_observations(self, payload: dict) -> tuple[list[str], str]:
        system_prompt, user_prompt = self.prompt_builder.build_session_insight_messages(
            payload,
        )
        provider_result = self.client.complete_json(
            system_prompt,
            user_prompt,
            operation="session_insight",
        )
        return self.parser.parse(provider_result["content"]), provider_result.get(
            "model",
            "",
        )

    def begin_processing(self, session: FocusSession) -> SessionInsight:
        with transaction.atomic():
            insight, _ = SessionInsight.objects.select_for_update().get_or_create(
                session=session,
            )
            if insight.status == SessionInsight.Status.COMPLETED:
                return insight
            if (
                insight.status == SessionInsight.Status.PROCESSING
                and not self.is_processing_stale(insight)
            ):
                return insight
            insight.status = SessionInsight.Status.PROCESSING
            insight.started_at = timezone.now()
            insight.error_code = ""
            insight.error_message = ""
            insight.save(
                update_fields=[
                    "status",
                    "started_at",
                    "error_code",
                    "error_message",
                    "updated_at",
                ],
            )
            return insight

    def queue_manual_retry(self, session: FocusSession) -> SessionInsight:
        if not self.is_session_eligible(session):
            raise SessionInsightValidationError(
                ERROR_SESSION_NOT_ELIGIBLE,
                "Session is not eligible for AI insight retry.",
            )

        with transaction.atomic():
            insight, _ = SessionInsight.objects.select_for_update().get_or_create(
                session=session,
            )
            if (
                insight.status == SessionInsight.Status.COMPLETED
                and insight.source == SessionInsight.Source.AI
            ):
                raise SessionInsightConflict(
                    ERROR_ALREADY_COMPLETED,
                    "AI session insight has already completed.",
                )
            if (
                insight.status == SessionInsight.Status.PROCESSING
                and not self.is_processing_stale(insight)
            ):
                raise SessionInsightConflict(
                    ERROR_ALREADY_PROCESSING,
                    "AI session insight is already processing.",
                )
            if insight.status == SessionInsight.Status.PENDING:
                raise SessionInsightConflict(
                    ERROR_ALREADY_PROCESSING,
                    "AI session insight regeneration is already queued.",
                )
            if insight.retry_count >= settings.SESSION_INSIGHT_MANUAL_RETRY_LIMIT:
                raise SessionInsightConflict(
                    ERROR_RETRY_LIMIT_REACHED,
                    "AI session insight retry limit has been reached.",
                )

            insight.status = SessionInsight.Status.PENDING
            insight.observations = []
            insight.source = ""
            insight.model_name = ""
            insight.retry_count += 1
            insight.error_code = ""
            insight.error_message = ""
            insight.started_at = None
            insight.generated_at = None
            insight.save()
            transaction.on_commit(lambda: self.enqueue_generation(session.id))
            return insight

    def get_or_create_pending(self, session: FocusSession) -> SessionInsight:
        insight, _ = SessionInsight.objects.get_or_create(session=session)
        return insight

    def get_or_create_insight(self, session: FocusSession) -> SessionInsight:
        insight, _ = SessionInsight.objects.get_or_create(session=session)
        return insight

    def complete_with_fallback(
        self,
        insight: SessionInsight,
        payload: dict,
        exc: Exception,
    ):
        observations = self.fallback.build(payload)
        if observations:
            log_ai_event(
                "ai_session_insight_fallback",
                operation="session_insight",
                provider=getattr(exc, "provider", AIClient.PROVIDER),
                session_id=insight.session_id,
                error_code=self.error_code_for_exception(exc),
                retryable=getattr(exc, "retryable", False),
                fallback_applied=True,
            )
            self.mark_completed(
                insight,
                observations=observations,
                source=SessionInsight.Source.RULE_BASED_FALLBACK,
                model_name="",
                error_code=self.error_code_for_exception(exc),
                error_message=self.sanitize_error_message(exc),
            )
        else:
            self.mark_failed(
                insight,
                self.error_code_for_exception(exc),
                self.sanitize_error_message(exc),
            )

    def mark_completed(
        self,
        insight: SessionInsight,
        observations: list[str],
        source: str,
        model_name: str = "",
        error_code: str = "",
        error_message: str = "",
    ):
        with transaction.atomic():
            locked = SessionInsight.objects.select_for_update().get(pk=insight.pk)
            locked.status = SessionInsight.Status.COMPLETED
            locked.observations = observations[:4]
            locked.source = source
            locked.model_name = model_name or ""
            locked.error_code = error_code
            locked.error_message = error_message
            locked.generated_at = timezone.now()
            locked.save()
            insight.refresh_from_db()

    def mark_pending_for_automatic_retry(self, insight: SessionInsight, exc: Exception):
        with transaction.atomic():
            locked = SessionInsight.objects.select_for_update().get(pk=insight.pk)
            locked.status = SessionInsight.Status.PENDING
            locked.error_code = self.error_code_for_exception(exc)
            locked.error_message = self.sanitize_error_message(exc)
            locked.save(
                update_fields=[
                    "status",
                    "error_code",
                    "error_message",
                    "updated_at",
                ],
            )

    def mark_failed(self, insight: SessionInsight, error_code: str, message: str):
        with transaction.atomic():
            locked = SessionInsight.objects.select_for_update().get(pk=insight.pk)
            locked.status = SessionInsight.Status.FAILED
            locked.error_code = error_code
            locked.error_message = message[:500]
            locked.save(
                update_fields=[
                    "status",
                    "error_code",
                    "error_message",
                    "updated_at",
                ],
            )
            insight.refresh_from_db()

    def is_processing_stale(self, insight: SessionInsight) -> bool:
        if insight.status != SessionInsight.Status.PROCESSING or not insight.started_at:
            return False
        threshold = timezone.now() - timedelta(
            seconds=settings.SESSION_INSIGHT_STALE_PROCESSING_SECONDS,
        )
        return insight.started_at < threshold

    def enqueue_generation(self, session_id):
        from apps.ai.tasks import generate_session_insight

        try:
            generate_session_insight.delay(str(session_id))
        except Exception:
            return None

    @staticmethod
    def error_code_for_exception(exc: Exception) -> str:
        return getattr(exc, "error_code", "AI_PROVIDER_ERROR")

    @staticmethod
    def sanitize_error_message(exc: Exception) -> str:
        message = str(exc) or SessionInsightService.error_code_for_exception(exc)
        return message.replace("\n", " ").replace("\r", " ")[:500]

    @staticmethod
    def serialize(insight: SessionInsight) -> dict:
        return {
            "session_id": str(insight.session_id),
            "status": insight.status,
            "observations": insight.observations or [],
            "source": insight.source or None,
            "model": insight.model_name or None,
            "generated_at": insight.generated_at,
            "retry_count": insight.retry_count,
            "error_code": insight.error_code or None,
        }

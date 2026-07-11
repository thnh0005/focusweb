from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.ai.models import AIAnalysisResult
from apps.tracking.models import BrowserEvent, WarningCycle, WarningEvent

from .realtime_score import (
    DECISION_DISTRACTED,
    DECISION_FOCUSED,
    DECISION_POTENTIALLY_DISTRACTED,
    RealtimeScoreCalculator,
    RealtimeScoreConfig,
)


class RealtimeScoreService:
    AI_FOCUS_STATE_TO_DECISION_STATE = {
        AIAnalysisResult.FocusState.FOCUSED: DECISION_FOCUSED,
        AIAnalysisResult.FocusState.POTENTIALLY_DISTRACTED: (
            DECISION_POTENTIALLY_DISTRACTED
        ),
        AIAnalysisResult.FocusState.DISTRACTED: DECISION_DISTRACTED,
    }

    def __init__(
        self,
        calculator: RealtimeScoreCalculator | None = None,
        config: RealtimeScoreConfig | None = None,
    ):
        self.config = config or RealtimeScoreConfig(
            window_seconds=settings.REALTIME_SCORE_WINDOW_SECONDS,
            stale_seconds=settings.REALTIME_SCORE_STALE_SECONDS,
            min_events=settings.REALTIME_SCORE_MIN_EVENTS,
            tab_switch_penalty=settings.REALTIME_SCORE_TAB_SWITCH_PENALTY,
        )
        self.calculator = calculator or RealtimeScoreCalculator(self.config)

    def calculate_for_session(self, session, now=None) -> dict:
        now = now or timezone.now()
        window_start = now - timedelta(seconds=self.config.window_seconds)
        events = list(
            BrowserEvent.objects.filter(
                session_id=session.id,
                created_at__gte=window_start,
                created_at__lte=now,
            )
            .order_by("created_at")
            .values(
                "id",
                "created_at",
                "active_seconds",
                "idle_seconds",
                "tab_switch_count",
            )
        )
        event_ids = [event["id"] for event in events]
        analyses = list(
            AIAnalysisResult.objects.filter(
                session_id=session.id,
                browser_event_id__in=event_ids,
                created_at__gte=window_start,
                created_at__lte=now,
                error_message="",
            ).values(
                "browser_event_id",
                "relevance_score",
                "focus_state",
                "raw_response",
            )
        )
        relevance_scores = [
            analysis["relevance_score"]
            for analysis in analyses
            if analysis["focus_state"] != AIAnalysisResult.FocusState.UNKNOWN
        ]
        decision_states = [
            self.AI_FOCUS_STATE_TO_DECISION_STATE[analysis["focus_state"]]
            for analysis in analyses
            if analysis["focus_state"] in self.AI_FOCUS_STATE_TO_DECISION_STATE
        ]
        warnings = list(
            WarningEvent.objects.filter(
                session_id=session.id,
                created_at__gte=window_start,
                created_at__lte=now,
            ).values(
                "decision_score",
                "warning_level",
                "auto_pause_required",
            )
        )
        active_warning_cycle_count = (
            WarningCycle.objects.active()
            .filter(session_id=session.id, started_at__lte=now)
            .count()
        )
        distraction_scores = [
            self.warning_control_score(warning) for warning in warnings
        ]
        distraction_scores = [
            score for score in distraction_scores if score is not None
        ]
        if active_warning_cycle_count and not distraction_scores:
            distraction_scores.extend([35] * active_warning_cycle_count)
        ai_status = "OK"
        ai_error_code = None
        if events and not relevance_scores and not settings.AI_SEMANTIC_REALTIME_ENABLED:
            ai_status = "DISABLED"
            ai_error_code = "REALTIME_AI_DISABLED"
        elif events and not relevance_scores:
            ai_status = "DEGRADED"
            ai_error_code = "AI_UNAVAILABLE"
        stale = self.is_stale(events, now)
        source = (
            "tracking_signals"
            if events or warnings or active_warning_cycle_count or relevance_scores
            else "insufficient_tracking"
        )
        result = self.calculator.calculate(
            events=events,
            relevance_scores=relevance_scores,
            decision_states=decision_states,
            distraction_scores=distraction_scores,
            stale=stale,
            ai_status=ai_status,
            ai_error_code=ai_error_code,
            source=source,
        )
        result.update(
            {
                "session_id": str(session.id),
                "session_status": session.status,
                "calculated_at": now,
                "warning_count": len(warnings),
                "active_warning_cycle_count": active_warning_cycle_count,
            }
        )
        return result

    def is_stale(self, events: list[dict], now) -> bool:
        if not events:
            return False
        latest = max(event["created_at"] for event in events)
        return (now - latest).total_seconds() > self.config.stale_seconds

    @staticmethod
    def warning_control_score(warning: dict) -> int | None:
        decision_score = warning.get("decision_score")
        if decision_score is not None:
            return RealtimeScoreCalculator.clamp_int(100 - decision_score)

        level = warning.get("warning_level")
        if level is None:
            return None
        penalty = int(level) * 20
        if warning.get("auto_pause_required"):
            penalty += 20
        return RealtimeScoreCalculator.clamp_int(100 - penalty)

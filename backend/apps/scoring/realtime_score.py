from copy import deepcopy
from dataclasses import dataclass


COMPONENT_CONTENT_RELEVANCE = "content_relevance"
COMPONENT_FOCUS_CONTINUITY = "focus_continuity"
COMPONENT_TAB_STABILITY = "tab_stability"
COMPONENT_DISTRACTION_CONTROL = "distraction_control"

DATA_QUALITY_INSUFFICIENT = "INSUFFICIENT"
DATA_QUALITY_PARTIAL = "PARTIAL"
DATA_QUALITY_SUFFICIENT = "SUFFICIENT"

LABEL_DEEP_FOCUS = "DEEP_FOCUS"
LABEL_FOCUSED = "FOCUSED"
LABEL_AVERAGE = "AVERAGE"
LABEL_DISTRACTED = "DISTRACTED"
LABEL_HIGHLY_DISTRACTED = "HIGHLY_DISTRACTED"

DECISION_FOCUSED = "FOCUSED"
DECISION_POTENTIALLY_DISTRACTED = "POTENTIALLY_DISTRACTED"
DECISION_DISTRACTED = "DISTRACTED"


@dataclass(frozen=True)
class RealtimeScoreConfig:
    window_seconds: int = 300
    stale_seconds: int = 90
    min_events: int = 3
    tab_switch_penalty: int = 8
    weights: dict | None = None

    def component_weights(self) -> dict:
        return self.weights or {
            COMPONENT_CONTENT_RELEVANCE: 0.40,
            COMPONENT_FOCUS_CONTINUITY: 0.30,
            COMPONENT_TAB_STABILITY: 0.15,
            COMPONENT_DISTRACTION_CONTROL: 0.15,
        }


class RealtimeScoreCalculator:
    DECISION_CONTROL_SCORES = {
        DECISION_FOCUSED: 100,
        DECISION_POTENTIALLY_DISTRACTED: 60,
        DECISION_DISTRACTED: 20,
    }

    def __init__(self, config: RealtimeScoreConfig | None = None):
        self.config = config or RealtimeScoreConfig()

    def calculate(
        self,
        events: list[dict] | None,
        relevance_scores: list | None = None,
        decision_states: list | None = None,
        distraction_scores: list | None = None,
        stale: bool = False,
        ai_status: str = "OK",
        ai_error_code: str | None = None,
        source: str | None = None,
    ) -> dict:
        events = deepcopy(events or [])
        relevance_scores = deepcopy(relevance_scores or [])
        decision_states = deepcopy(decision_states or [])
        distraction_scores = deepcopy(distraction_scores or [])
        event_count = len(events)
        components = {
            COMPONENT_CONTENT_RELEVANCE: self.average_score(relevance_scores),
            COMPONENT_FOCUS_CONTINUITY: self.calculate_focus_continuity(events),
            COMPONENT_TAB_STABILITY: self.calculate_tab_stability(events),
            COMPONENT_DISTRACTION_CONTROL: self.calculate_distraction_control(
                decision_states,
                distraction_scores,
            ),
        }

        if event_count < self.config.min_events:
            return self.result(
                score=None,
                label=None,
                components=components,
                event_count=event_count,
                data_quality=DATA_QUALITY_INSUFFICIENT,
                stale=stale,
                ai_status=ai_status,
                ai_error_code=ai_error_code,
                source=source or "insufficient_tracking",
            )

        score = self.weighted_total(components)
        data_quality = (
            DATA_QUALITY_SUFFICIENT
            if all(value is not None for value in components.values())
            else DATA_QUALITY_PARTIAL
        )
        return self.result(
            score=score,
            label=self.label_for_score(score) if score is not None else None,
            components=components,
            event_count=event_count,
            data_quality=data_quality,
            stale=stale,
            ai_status=ai_status,
            ai_error_code=ai_error_code,
            source=source or "tracking_events",
        )

    def result(
        self,
        score,
        label,
        components,
        event_count,
        data_quality,
        stale,
        ai_status,
        ai_error_code,
        source,
    ) -> dict:
        return {
            "score": score,
            "label": label,
            "components": components,
            "weights": self.config.component_weights(),
            "window_seconds": self.config.window_seconds,
            "event_count": event_count,
            "data_quality": data_quality,
            "stale": bool(stale),
            "ai_status": ai_status,
            "ai_error_code": ai_error_code,
            "source": source,
        }

    def weighted_total(self, components: dict) -> int | None:
        weights = self.config.component_weights()
        available = {
            key: value
            for key, value in components.items()
            if value is not None and key in weights
        }
        available_weight = sum(weights[key] for key in available)
        if available_weight <= 0:
            return None
        total = sum(available[key] * weights[key] for key in available)
        return self.clamp_int(total / available_weight)

    def calculate_focus_continuity(self, events: list[dict]) -> int | None:
        active_seconds = self.aggregate_counter(events, "active_seconds")
        idle_seconds = self.aggregate_counter(events, "idle_seconds")
        observed_seconds = active_seconds + idle_seconds
        if observed_seconds <= 0:
            return None
        return self.clamp_int(100 - (idle_seconds / observed_seconds) * 100)

    def calculate_tab_stability(self, events: list[dict]) -> int | None:
        if not events:
            return None
        tab_switch_count = self.aggregate_counter(events, "tab_switch_count")
        return self.clamp_int(100 - tab_switch_count * self.config.tab_switch_penalty)

    def calculate_distraction_control(
        self,
        decision_states: list,
        control_scores: list | None = None,
    ) -> int | None:
        scores = [
            self.DECISION_CONTROL_SCORES[state]
            for state in decision_states
            if state in self.DECISION_CONTROL_SCORES
        ]
        scores.extend(control_scores or [])
        return self.average_score(scores)

    def average_score(self, values: list) -> int | None:
        normalized = [self.clamp_float(value, 0, 100) for value in values]
        normalized = [value for value in normalized if value is not None]
        if not normalized:
            return None
        return self.clamp_int(sum(normalized) / len(normalized))

    def aggregate_counter(self, events: list[dict], field: str) -> int:
        values = [self.clamp_float(event.get(field), 0, None) for event in events]
        values = [value for value in values if value is not None]
        if not values:
            return 0

        # If snapshots are monotonic and changing, treat them as cumulative counters
        # and use the observed in-window delta instead of summing every snapshot.
        if len(values) > 1 and len(set(values)) > 1 and values == sorted(values):
            return self.clamp_int(max(values) - min(values), 0, None)
        return self.clamp_int(sum(values), 0, None)

    @staticmethod
    def label_for_score(score: int) -> str:
        score = RealtimeScoreCalculator.clamp_int(score)
        if score >= 90:
            return LABEL_DEEP_FOCUS
        if score >= 75:
            return LABEL_FOCUSED
        if score >= 60:
            return LABEL_AVERAGE
        if score >= 40:
            return LABEL_DISTRACTED
        return LABEL_HIGHLY_DISTRACTED

    @staticmethod
    def clamp_float(value, minimum=0, maximum=100):
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if minimum is not None:
            number = max(minimum, number)
        if maximum is not None:
            number = min(maximum, number)
        return number

    @staticmethod
    def clamp_int(value, minimum=0, maximum=100) -> int:
        try:
            number = round(float(value))
        except (TypeError, ValueError):
            number = minimum or 0
        if minimum is not None:
            number = max(minimum, number)
        if maximum is not None:
            number = min(maximum, number)
        return int(number)

from django.db.models import Avg, Count, Q

from apps.ai.models import AIAnalysisResult
from apps.sessions.models import FocusSession
from apps.tracking.models import BrowserEvent, WarningCycle, WarningEvent

from ..models import FocusScore, ScoreComponent
from ..realtime_score import RealtimeScoreCalculator


class ScoreCalculator:
    WEIGHTS = {
        ScoreComponent.Key.CONTENT_RELEVANCE: 0.40,
        ScoreComponent.Key.FOCUS_CONTINUITY: 0.30,
        ScoreComponent.Key.TAB_STABILITY: 0.15,
        ScoreComponent.Key.DISTRACTION_PENALTY: 0.15,
    }

    def calculate_realtime_score(self, events: list) -> dict:
        result = RealtimeScoreCalculator().calculate(events=events)
        state = (
            self.classify_focus_state(result["score"])
            if result["score"] is not None
            else None
        )
        return {
            "score": result["score"],
            "state": state,
            "source": "tracking_events" if events else "insufficient_tracking",
            "components": result["components"],
            "data_quality": result["data_quality"],
        }

    def classify_focus_state(self, score):
        if score >= 90:
            return FocusScore.State.DEEP_FOCUS
        if score >= 75:
            return FocusScore.State.FOCUSED
        if score >= 60:
            return FocusScore.State.AVERAGE
        if score >= 40:
            return FocusScore.State.DISTRACTED
        return FocusScore.State.HIGHLY_DISTRACTED

    def calculate_weighted_total(self, components):
        bounded_components = {
            key: max(0, min(100, components.get(key, 0))) for key in self.WEIGHTS
        }
        total = round(
            sum(bounded_components[key] * self.WEIGHTS[key] for key in self.WEIGHTS)
        )
        return max(0, min(100, total))

    @staticmethod
    def clamp_score(value):
        try:
            number = float(value)
        except (TypeError, ValueError):
            number = 0
        return max(0, min(100, number))

    @staticmethod
    def average(values):
        normalized = [
            ScoreCalculator.clamp_score(value)
            for value in values
            if value is not None
        ]
        if not normalized:
            return None
        return sum(normalized) / len(normalized)

    @staticmethod
    def aggregate_counter(rows, field):
        values = [
            int(max(0, row.get(field) or 0))
            for row in rows
            if row.get(field) is not None
        ]
        if not values:
            return 0
        if len(values) > 1 and len(set(values)) > 1 and values == sorted(values):
            return max(values) - min(values)
        return sum(values)

    def calculate_warning_control(self, warning_rows, active_cycle_count):
        if not warning_rows and not active_cycle_count:
            return 100

        level_penalty = sum((row.get("warning_level") or 0) * 6 for row in warning_rows)
        auto_pause_penalty = sum(
            15 for row in warning_rows if row.get("auto_pause_required")
        )
        cycle_penalty = active_cycle_count * 8
        decision_penalty = self.average(
            row.get("decision_score") for row in warning_rows
        )
        if decision_penalty is not None:
            decision_penalty *= 0.6

        penalty = max(
            level_penalty + auto_pause_penalty + cycle_penalty,
            decision_penalty or 0,
        )
        return round(self.clamp_score(100 - min(90, penalty)), 2)

    def calculate_final_score(self, session):
        target_seconds = max(1, session.target_duration_seconds)
        duration_ratio = min(1, session.actual_duration_seconds / target_seconds)
        duration_score = round(duration_ratio * 100, 2)

        browser_events = list(
            BrowserEvent.objects.filter(session_id=session.id)
            .order_by("created_at")
            .values(
                "active_seconds",
                "idle_seconds",
                "tab_switch_count",
                "domain",
            )
        )
        active_seconds = self.aggregate_counter(browser_events, "active_seconds")
        idle_seconds = self.aggregate_counter(browser_events, "idle_seconds")
        observed_seconds = active_seconds + idle_seconds
        activity_score = None
        if observed_seconds > 0:
            activity_score = round(
                self.clamp_score(100 - (idle_seconds / observed_seconds) * 100),
                2,
            )
        focus_continuity = duration_score
        if activity_score is not None:
            focus_continuity = round((duration_score * 0.75) + (activity_score * 0.25), 2)

        tab_switch_count = self.aggregate_counter(browser_events, "tab_switch_count")
        tab_stability = 100
        if browser_events:
            tab_stability = round(self.clamp_score(100 - tab_switch_count * 5), 2)

        semantic_stats = (
            AIAnalysisResult.objects.filter(
                session_id=session.id,
                error_message="",
            )
            .exclude(focus_state=AIAnalysisResult.FocusState.UNKNOWN)
            .aggregate(count=Count("id"), average=Avg("relevance_score"))
        )
        has_semantic_ai = semantic_stats["count"] > 0
        if has_semantic_ai:
            content_relevance = round(self.clamp_score(semantic_stats["average"]), 2)
        else:
            content_relevance = 90 if session.mode == FocusSession.Mode.DEEP_WORK else 100

        warning_queryset = WarningEvent.objects.filter(session_id=session.id)
        warning_rows = list(
            warning_queryset.values(
                "warning_level",
                "decision_score",
                "auto_pause_required",
                "domain",
            )
        )
        warning_stats = warning_queryset.aggregate(
            count=Count("id"),
            average_decision_score=Avg("decision_score"),
            auto_pause_count=Count("id", filter=Q(auto_pause_required=True)),
        )
        cycle_queryset = WarningCycle.objects.filter(session_id=session.id)
        active_cycle_statuses = [
            WarningCycle.Status.WARNING_1_SENT,
            WarningCycle.Status.WARNING_2_SENT,
            WarningCycle.Status.WARNING_3_SENT,
            WarningCycle.Status.AUTO_PAUSE_REQUIRED,
        ]
        cycle_stats = cycle_queryset.aggregate(
            count=Count("id"),
            active_count=Count("id", filter=Q(status__in=active_cycle_statuses)),
            auto_pause_count=Count("id", filter=Q(auto_pause_required=True)),
        )
        distraction_control = self.calculate_warning_control(
            warning_rows,
            cycle_stats["active_count"],
        )

        components = {
            ScoreComponent.Key.CONTENT_RELEVANCE: content_relevance,
            ScoreComponent.Key.FOCUS_CONTINUITY: focus_continuity,
            ScoreComponent.Key.TAB_STABILITY: tab_stability,
            ScoreComponent.Key.DISTRACTION_PENALTY: distraction_control,
        }
        total = self.calculate_weighted_total(components)
        has_tracking_signals = bool(
            browser_events
            or warning_stats["count"]
            or cycle_stats["count"]
            or has_semantic_ai
        )
        top_warning_domains = list(
            warning_queryset.exclude(domain="")
            .values("domain")
            .annotate(count=Count("id"))
            .order_by("-count", "domain")[:5]
        )
        return {
            "total": total,
            "state": self.classify_focus_state(total),
            "components": components,
            "component_metadata": {
                ScoreComponent.Key.CONTENT_RELEVANCE: {
                    "semanticAnalysisCount": semantic_stats["count"],
                    "fallback": not has_semantic_ai,
                },
                ScoreComponent.Key.FOCUS_CONTINUITY: {
                    "durationRatio": round(duration_ratio, 4),
                    "activeSeconds": active_seconds,
                    "idleSeconds": idle_seconds,
                },
                ScoreComponent.Key.TAB_STABILITY: {
                    "browserEventCount": len(browser_events),
                    "tabSwitchCount": tab_switch_count,
                },
                ScoreComponent.Key.DISTRACTION_PENALTY: {
                    "warningCount": warning_stats["count"],
                    "warningCycleCount": cycle_stats["count"],
                    "activeWarningCycleCount": cycle_stats["active_count"],
                    "autoPauseCount": (
                        warning_stats["auto_pause_count"]
                        + cycle_stats["auto_pause_count"]
                    ),
                    "averageDecisionScore": warning_stats["average_decision_score"],
                },
            },
            "metadata": {
                "durationRatio": round(duration_ratio, 4),
                "hasTrackingSignals": has_tracking_signals,
                "hasBrowserEvents": bool(browser_events),
                "hasSemanticAi": has_semantic_ai,
                "hasWarningEvents": warning_stats["count"] > 0,
                "browserEventCount": len(browser_events),
                "warningCount": warning_stats["count"],
                "warningCycleCount": cycle_stats["count"],
                "semanticAnalysisCount": semantic_stats["count"],
                "topWarningDomains": top_warning_domains,
                "source": "tracking_signals" if has_tracking_signals else "duration_fallback",
            },
        }

    def persist_final_score(self, session):
        result = self.calculate_final_score(session)
        score, _ = FocusScore.objects.update_or_create(
            session=session,
            defaults={
                "user": session.user,
                "total_score": result["total"],
                "focus_state": result["state"],
                "source": result["metadata"]["source"],
                "metadata": result["metadata"],
            },
        )
        labels = dict(ScoreComponent.Key.choices)
        for key, value in result["components"].items():
            ScoreComponent.objects.update_or_create(
                score=score,
                key=key,
                defaults={
                    "label": labels[key],
                    "value": value,
                    "weight": self.WEIGHTS[key],
                    "metadata": result.get("component_metadata", {}).get(key, {}),
                },
            )
        FocusSession.objects.filter(pk=session.pk).update(
            focus_score=result["total"],
            focus_state=result["state"],
        )
        session.focus_score = result["total"]
        session.focus_state = result["state"]
        return score

from apps.sessions.models import FocusSession

from ..models import FocusScore, ScoreComponent


class ScoreCalculator:
    WEIGHTS = {
        ScoreComponent.Key.CONTENT_RELEVANCE: 0.40,
        ScoreComponent.Key.FOCUS_CONTINUITY: 0.30,
        ScoreComponent.Key.TAB_STABILITY: 0.15,
        ScoreComponent.Key.DISTRACTION_PENALTY: 0.15,
    }

    def calculate_realtime_score(self, events: list) -> dict:
        return {
            "score": 100,
            "state": "focused",
            "source": "mock",
        }

    def classify_focus_state(self, score):
        """Ánh xạ điểm số sang nhãn focus ổn định mà frontend đang dùng."""
        if score >= 85:
            return FocusScore.State.DEEP_FOCUS
        if score >= 70:
            return FocusScore.State.FOCUSED
        if score >= 50:
            return FocusScore.State.AVERAGE
        if score >= 30:
            return FocusScore.State.DISTRACTED
        return FocusScore.State.HIGHLY_DISTRACTED

    def calculate_final_score(self, session):
        """Tính final score tuần 2 từ dữ liệu session thuộc phạm vi Dev1.

        Dev2 có thể bổ sung warning count, tab switch và semantic relevance
        vào cùng các component này mà không đổi contract của Summary API.
        """
        target_seconds = max(1, session.target_duration_seconds)
        duration_ratio = min(1, session.actual_duration_seconds / target_seconds)
        content_relevance = 90 if session.mode == FocusSession.Mode.DEEP_WORK else 100
        components = {
            ScoreComponent.Key.CONTENT_RELEVANCE: content_relevance,
            ScoreComponent.Key.FOCUS_CONTINUITY: round(duration_ratio * 100, 2),
            ScoreComponent.Key.TAB_STABILITY: 100,
            ScoreComponent.Key.DISTRACTION_PENALTY: 100,
        }
        total = round(
            sum(components[key] * self.WEIGHTS[key] for key in self.WEIGHTS)
        )
        total = max(0, min(100, total))
        return {
            "total": total,
            "state": self.classify_focus_state(total),
            "components": components,
            "metadata": {
                "durationRatio": round(duration_ratio, 4),
                "hasSemanticAi": False,
                "hasWarningEvents": False,
                "source": "session-duration-fallback",
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
                    "metadata": {},
                },
            )
        FocusSession.objects.filter(pk=session.pk).update(
            focus_score=result["total"],
            focus_state=result["state"],
        )
        session.focus_score = result["total"]
        session.focus_state = result["state"]
        return score

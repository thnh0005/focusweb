import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class FocusScore(models.Model):
    """Lưu điểm focus cuối cùng của một session đã hoàn thành."""

    class State(models.TextChoices):
        DEEP_FOCUS = "deep-focus", "Deep Focus"
        FOCUSED = "focused", "Focused"
        AVERAGE = "average", "Average"
        DISTRACTED = "distracted", "Distracted"
        HIGHLY_DISTRACTED = "highly-distracted", "Highly Distracted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="focus_scores",
    )
    session = models.OneToOneField(
        "focus_sessions.FocusSession",
        on_delete=models.CASCADE,
        related_name="score_result",
    )
    total_score = models.PositiveSmallIntegerField()
    focus_state = models.CharField(max_length=32, choices=State.choices)
    source = models.CharField(max_length=32, default="server-final")
    metadata = models.JSONField(default=dict, blank=True)
    calculated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-calculated_at"]
        indexes = [
            models.Index(fields=["user", "calculated_at"]),
            models.Index(fields=["user", "focus_state"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(total_score__gte=0, total_score__lte=100),
                name="focus_score_total_between_0_100",
            ),
        ]

    def __str__(self):
        return f"{self.session_id}: {self.total_score}"


class ScoreComponent(models.Model):
    """Lưu từng phần điểm để màn summary hiển thị breakdown rõ ràng."""

    class Key(models.TextChoices):
        CONTENT_RELEVANCE = "content_relevance", "Content relevance"
        FOCUS_CONTINUITY = "focus_continuity", "Focus continuity"
        TAB_STABILITY = "tab_stability", "Tab stability"
        DISTRACTION_PENALTY = "distraction_penalty", "Distraction penalty"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    score = models.ForeignKey(
        FocusScore,
        on_delete=models.CASCADE,
        related_name="components",
    )
    key = models.CharField(max_length=32, choices=Key.choices)
    label = models.CharField(max_length=80)
    value = models.FloatField()
    weight = models.FloatField()
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["key"]
        constraints = [
            models.CheckConstraint(
                condition=Q(value__gte=0, value__lte=100),
                name="score_component_value_between_0_100",
            ),
            models.CheckConstraint(
                condition=Q(weight__gte=0, weight__lte=1),
                name="score_component_weight_between_0_1",
            ),
            models.UniqueConstraint(
                fields=["score", "key"],
                name="unique_focus_score_component_key",
            ),
        ]

    def __str__(self):
        return f"{self.score_id}: {self.key}={self.value}"

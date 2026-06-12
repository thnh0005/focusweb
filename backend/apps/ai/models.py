import uuid

from django.db import models


class AIAnalysisResult(models.Model):
    class FocusState(models.TextChoices):
        FOCUSED = "focused", "Focused"
        POTENTIALLY_DISTRACTED = (
            "potentially_distracted",
            "Potentially Distracted",
        )
        DISTRACTED = "distracted", "Distracted"
        UNKNOWN = "unknown", "Unknown"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.UUIDField()
    browser_event_id = models.UUIDField(null=True, blank=True)
    provider = models.CharField(max_length=100, blank=True)
    model_name = models.CharField(max_length=100, blank=True)
    session_goal = models.TextField(blank=True)
    page_title = models.CharField(max_length=500, blank=True)
    domain = models.CharField(max_length=255, blank=True)
    content_snippet = models.TextField(blank=True)
    relevance_score = models.FloatField(default=0.0)
    is_relevant = models.BooleanField(default=False)
    focus_state = models.CharField(
        max_length=32,
        choices=FocusState.choices,
        default=FocusState.UNKNOWN,
    )
    reason = models.TextField(blank=True)
    raw_response = models.JSONField(default=dict, blank=True)
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["session_id", "created_at"]),
            models.Index(fields=["relevance_score"]),
            models.Index(fields=["focus_state"]),
            models.Index(fields=["is_relevant"]),
        ]

    def __str__(self):
        return (
            f"AI {self.relevance_score:.2f} "
            f"{self.focus_state}: {self.session_id}"
        )


class SessionInsight(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    class Source(models.TextChoices):
        AI = "AI", "AI"
        RULE_BASED_FALLBACK = "RULE_BASED_FALLBACK", "Rule-based fallback"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.OneToOneField(
        "focus_sessions.FocusSession",
        on_delete=models.CASCADE,
        related_name="ai_insight",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    observations = models.JSONField(default=list, blank=True)
    source = models.CharField(
        max_length=32,
        choices=Source.choices,
        blank=True,
    )
    model_name = models.CharField(max_length=100, blank=True)
    retry_count = models.PositiveSmallIntegerField(default=0)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "updated_at"]),
        ]

    def __str__(self):
        return f"Session insight {self.session_id}: {self.status}"

import uuid

from django.db import models


class BrowserEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.UUIDField()
    event_type = models.CharField(max_length=64)
    url = models.URLField(max_length=2048, blank=True)
    domain = models.CharField(max_length=255, blank=True)
    page_title = models.CharField(max_length=500, blank=True)
    meta_description = models.TextField(blank=True)
    content_snippet = models.TextField(blank=True)
    active_seconds = models.PositiveIntegerField(default=0)
    idle_seconds = models.PositiveIntegerField(default=0)
    tab_switch_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["session_id", "created_at"]),
            models.Index(fields=["session_id", "event_type"]),
            models.Index(fields=["domain"]),
        ]

    def __str__(self):
        return f"{self.event_type}: {self.domain or self.session_id}"


class EventBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.UUIDField()
    batch_size = models.PositiveIntegerField()
    processed = models.BooleanField(default=False)
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-received_at"]
        indexes = [
            models.Index(fields=["processed", "received_at"]),
            models.Index(fields=["session_id", "received_at"]),
        ]

    def __str__(self):
        return f"Batch {self.id}: {self.batch_size} events"


class WarningEvent(models.Model):
    class WarningType(models.TextChoices):
        NORMAL_BLACKLIST = "normal_blacklist", "Normal Blacklist"
        DEEP_WORK_AI = "deep_work_ai", "Deep Work AI"
        IDLE = "idle", "Idle"
        TAB_SWITCH = "tab_switch", "Tab Switch"
        MANUAL = "manual", "Manual"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.UUIDField()
    browser_event = models.ForeignKey(
        BrowserEvent,
        on_delete=models.SET_NULL,
        related_name="warnings",
        null=True,
        blank=True,
    )
    warning_level = models.PositiveSmallIntegerField()
    warning_type = models.CharField(max_length=32, choices=WarningType.choices)
    domain = models.CharField(max_length=255, blank=True)
    url = models.URLField(max_length=2048, blank=True)
    message = models.TextField(blank=True)
    was_acknowledged = models.BooleanField(default=False)
    triggered_auto_pause = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(warning_level__in=[1, 2, 3]),
                name="warning_event_level_between_1_and_3",
            ),
        ]
        indexes = [
            models.Index(fields=["session_id", "created_at"]),
            models.Index(fields=["warning_level"]),
            models.Index(fields=["warning_type"]),
        ]

    def __str__(self):
        return f"Warning L{self.warning_level}: {self.session_id}"

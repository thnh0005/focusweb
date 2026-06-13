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
    warning_cycle = models.ForeignKey(
        "WarningCycle",
        on_delete=models.CASCADE,
        related_name="warnings",
        null=True,
        blank=True,
    )
    browser_event = models.ForeignKey(
        BrowserEvent,
        on_delete=models.SET_NULL,
        related_name="warnings",
        null=True,
        blank=True,
    )
    warning_level = models.PositiveSmallIntegerField()
    warning_type = models.CharField(max_length=32, choices=WarningType.choices)
    decision_state = models.CharField(max_length=32, blank=True)
    decision_source = models.CharField(max_length=32, blank=True)
    decision_score = models.PositiveSmallIntegerField(null=True, blank=True)
    reason_codes = models.JSONField(default=list, blank=True)
    domain = models.CharField(max_length=255, blank=True)
    url = models.URLField(max_length=2048, blank=True)
    message = models.TextField(blank=True)
    was_acknowledged = models.BooleanField(default=False)
    auto_pause_required = models.BooleanField(default=False)
    triggered_auto_pause = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(warning_level__in=[1, 2, 3]),
                name="warning_event_level_between_1_and_3",
            ),
            models.UniqueConstraint(
                fields=["warning_cycle", "warning_level"],
                condition=models.Q(warning_cycle__isnull=False),
                name="unique_warning_level_per_cycle",
            ),
        ]
        indexes = [
            models.Index(fields=["session_id", "created_at"]),
            models.Index(fields=["warning_level"]),
            models.Index(fields=["warning_type"]),
            models.Index(fields=["warning_cycle", "warning_level"]),
        ]

    def __str__(self):
        return f"Warning L{self.warning_level}: {self.session_id}"


class WarningCycleQuerySet(models.QuerySet):
    ACTIVE_STATUSES = [
        "warning_1_sent",
        "warning_2_sent",
        "warning_3_sent",
        "auto_pause_required",
    ]

    def active(self):
        return self.filter(status__in=self.ACTIVE_STATUSES)


class WarningCycle(models.Model):
    class Status(models.TextChoices):
        WARNING_1_SENT = "warning_1_sent", "Warning 1 Sent"
        WARNING_2_SENT = "warning_2_sent", "Warning 2 Sent"
        WARNING_3_SENT = "warning_3_sent", "Warning 3 Sent"
        RESOLVED = "resolved", "Resolved"
        COMPLETED = "completed", "Completed"
        AUTO_PAUSE_REQUIRED = "auto_pause_required", "Auto Pause Required"
        CANCELLED = "cancelled", "Cancelled"

    class Action(models.TextChoices):
        NONE = "NONE", "None"
        AUTO_PAUSE = "AUTO_PAUSE", "Auto Pause"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.UUIDField()
    source_event = models.ForeignKey(
        BrowserEvent,
        on_delete=models.SET_NULL,
        related_name="warning_cycles",
        null=True,
        blank=True,
    )
    idempotency_key = models.CharField(max_length=160, unique=True)
    mode = models.CharField(max_length=32, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices)
    current_level = models.PositiveSmallIntegerField(default=1)
    decision_state = models.CharField(max_length=32, blank=True)
    decision_source = models.CharField(max_length=32, blank=True)
    decision_score = models.PositiveSmallIntegerField(null=True, blank=True)
    reason_codes = models.JSONField(default=list, blank=True)
    domain = models.CharField(max_length=255, blank=True)
    auto_pause_required = models.BooleanField(default=False)
    action = models.CharField(
        max_length=32,
        choices=Action.choices,
        default=Action.NONE,
    )
    next_warning_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WarningCycleQuerySet.as_manager()

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["session_id", "status"]),
            models.Index(fields=["session_id", "started_at"]),
            models.Index(fields=["idempotency_key"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(current_level__in=[1, 2, 3]),
                name="warning_cycle_level_between_1_and_3",
            ),
            models.UniqueConstraint(
                fields=["session_id"],
                condition=models.Q(
                    status__in=WarningCycleQuerySet.ACTIVE_STATUSES,
                ),
                name="one_active_warning_cycle_per_session",
            ),
        ]

    def __str__(self):
        return f"Cycle {self.id}: {self.session_id} {self.status}"

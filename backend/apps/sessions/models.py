import secrets
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


def custom_template_id():
    return str(uuid.uuid4())


class GoalTemplateQuerySet(models.QuerySet):
    def available_to(self, user):
        """Trả template mặc định kèm template riêng của người dùng hiện tại."""
        return self.filter(Q(is_built_in=True) | Q(user=user)).order_by(
            "-last_used_at",
            "label",
        )


class GoalTemplate(models.Model):
    """Template goal mặc định hoặc template riêng để tạo session nhanh hơn."""

    id = models.CharField(
        primary_key=True,
        max_length=64,
        default=custom_template_id,
        editable=False,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="goal_templates",
        null=True,
        blank=True,
    )
    label = models.CharField(max_length=120)
    text = models.CharField(max_length=500)
    is_built_in = models.BooleanField(default=False)
    usage_count = models.PositiveIntegerField(default=0)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = GoalTemplateQuerySet.as_manager()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(is_built_in=True, user__isnull=True)
                    | Q(is_built_in=False, user__isnull=False)
                ),
                name="goal_template_owner_matches_type",
            ),
        ]

    def __str__(self):
        return self.label


class SessionTag(models.Model):
    """Tag thuộc từng user, dùng để gắn nhãn và lọc session ở history."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="session_tags",
    )
    name = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"],
                name="unique_session_tag_per_user",
            ),
        ]

    def __str__(self):
        return self.name


class FocusSession(models.Model):
    """Phiên tập trung chính, lưu lifecycle từ start tới pause/end/cancel."""

    class Mode(models.TextChoices):
        NORMAL = "normal", "Normal"
        DEEP_WORK = "deep-work", "Deep Work"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        AUTO_PAUSED = "auto-paused", "Auto Paused"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    OPEN_STATUSES = [Status.ACTIVE, Status.PAUSED, Status.AUTO_PAUSED]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="focus_sessions",
    )
    name = models.CharField(max_length=160, blank=True)
    mode = models.CharField(max_length=16, choices=Mode.choices)
    goal = models.CharField(max_length=500, blank=True)
    goal_template = models.ForeignKey(
        GoalTemplate,
        on_delete=models.SET_NULL,
        related_name="sessions",
        null=True,
        blank=True,
    )
    tags = models.ManyToManyField(SessionTag, related_name="sessions", blank=True)
    target_duration_seconds = models.PositiveIntegerField()
    actual_duration_seconds = models.PositiveIntegerField(default=0)
    focus_score = models.PositiveSmallIntegerField(null=True, blank=True)
    focus_state = models.CharField(max_length=32, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    accumulated_paused_seconds = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(default=timezone.now)
    paused_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    end_reason = models.CharField(max_length=120, blank=True)
    end_metadata = models.JSONField(default=dict, blank=True)
    extension_bridge_token = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-started_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=Q(status__in=["active", "paused", "auto-paused"]),
                name="one_open_focus_session_per_user",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["user", "started_at"]),
        ]

    def calculate_actual_duration(self, at=None):
        """Tính thời gian làm việc thật, đã trừ toàn bộ thời gian pause."""
        at = at or timezone.now()
        paused_seconds = self.accumulated_paused_seconds
        if self.paused_at:
            paused_seconds += max(0, int((at - self.paused_at).total_seconds()))
        elapsed_seconds = max(0, int((at - self.started_at).total_seconds()))
        return max(0, elapsed_seconds - paused_seconds)

    def ensure_extension_bridge_token(self):
        if self.extension_bridge_token:
            return self.extension_bridge_token
        self.extension_bridge_token = secrets.token_urlsafe(32)
        self.save(update_fields=["extension_bridge_token", "updated_at"])
        return self.extension_bridge_token

    def __str__(self):
        return f"{self.user.email}: {self.mode} ({self.status})"


class SessionNote(models.Model):
    """Ghi chú một-một với session để summary/history đọc lại được."""

    session = models.OneToOneField(
        FocusSession,
        on_delete=models.CASCADE,
        related_name="note",
    )
    content = models.TextField(blank=True, max_length=5000)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Note: {self.session_id}"


class SessionStateTransition(models.Model):
    """Audit log trạng thái để debug lifecycle và đồng bộ UI chính xác."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        FocusSession,
        on_delete=models.CASCADE,
        related_name="state_transitions",
    )
    from_status = models.CharField(max_length=16, blank=True)
    to_status = models.CharField(max_length=16, choices=FocusSession.Status.choices)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["occurred_at"]

    def __str__(self):
        return f"{self.session_id}: {self.from_status} -> {self.to_status}"


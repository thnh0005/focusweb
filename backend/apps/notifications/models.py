import uuid

from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        SESSION_REMINDER = "session_reminder", "Session reminder"
        WEEKLY_SUMMARY = "weekly_summary", "Weekly summary"
        DEEP_WORK_SUGGESTION = "deep_work_suggestion", "Deep work suggestion"
        TEST = "test", "Test"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CREATED = "created", "Created"
        DELIVERED = "delivered", "Delivered"
        FAILED = "failed", "Failed"
        READ = "read", "Read"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=32, choices=Type.choices)
    title = models.CharField(max_length=160)
    message = models.CharField(max_length=500)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.CREATED,
    )
    scheduled_for = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    dedupe_key = models.CharField(max_length=220, unique=True)
    read_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["user", "notification_type"]),
            models.Index(fields=["status", "scheduled_for"]),
        ]

    def __str__(self):
        return f"{self.user_id}: {self.notification_type}"


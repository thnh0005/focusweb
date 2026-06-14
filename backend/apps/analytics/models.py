import uuid

from django.conf import settings
from django.db import models


class ReportExportJob(models.Model):
    """Lưu kết quả export report dạng JSON/HTML fallback cho tuần 4."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"
        EXPIRED = "expired", "Expired"

    class Format(models.TextChoices):
        JSON = "json", "JSON"
        HTML = "html", "HTML"
        PDF = "pdf", "PDF"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="report_export_jobs",
    )
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.READY,
    )
    export_format = models.CharField(
        max_length=8,
        choices=Format.choices,
        default=Format.JSON,
    )
    date_range = models.CharField(max_length=12, default="7d")
    date_from = models.DateField(null=True, blank=True)
    date_to = models.DateField(null=True, blank=True)
    requested_timezone = models.CharField(max_length=64, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    download_url = models.CharField(max_length=255, blank=True)
    file = models.FileField(upload_to="reports/exports/", max_length=255, blank=True)
    file_size = models.PositiveIntegerField(default=0)
    checksum = models.CharField(max_length=64, blank=True)
    report_version = models.CharField(max_length=16, default="day25-v1")
    progress = models.PositiveSmallIntegerField(default=0)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.CharField(max_length=255, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    generation_fingerprint = models.CharField(max_length=64, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["user", "requested_at"]),
            models.Index(fields=["user", "generation_fingerprint"]),
            models.Index(fields=["status", "expires_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(progress__gte=0, progress__lte=100),
                name="report_export_progress_between_0_100",
            ),
            models.UniqueConstraint(
                fields=["user", "generation_fingerprint"],
                condition=~models.Q(generation_fingerprint=""),
                name="unique_report_export_fingerprint_per_user",
            ),
        ]

    def __str__(self):
        return f"{self.user_id}: {self.export_format} {self.status}"

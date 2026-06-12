import uuid

from django.conf import settings
from django.db import models


class ReportExportJob(models.Model):
    """Lưu kết quả export report dạng JSON/HTML fallback cho tuần 4."""

    class Status(models.TextChoices):
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

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
    payload = models.JSONField(default=dict, blank=True)
    download_url = models.CharField(max_length=255, blank=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-requested_at"]
        indexes = [models.Index(fields=["user", "requested_at"])]

    def __str__(self):
        return f"{self.user_id}: {self.export_format} {self.status}"

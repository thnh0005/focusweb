# Generated for Dev 1 week 4 report export jobs.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ReportExportJob",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("ready", "Ready"), ("failed", "Failed")],
                        default="ready",
                        max_length=12,
                    ),
                ),
                (
                    "export_format",
                    models.CharField(
                        choices=[("json", "JSON"), ("html", "HTML"), ("pdf", "PDF")],
                        default="json",
                        max_length=8,
                    ),
                ),
                ("date_range", models.CharField(default="7d", max_length=12)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("download_url", models.CharField(blank=True, max_length=255)),
                ("requested_at", models.DateTimeField(auto_now_add=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="report_export_jobs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-requested_at"],
                "indexes": [
                    models.Index(
                        fields=["user", "requested_at"],
                        name="analytics_r_user_id_864787_idx",
                    )
                ],
            },
        ),
    ]

# Generated for FocusOS Dev2 Week 3 Day 18.

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
            name="Notification",
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
                    "notification_type",
                    models.CharField(
                        choices=[
                            ("session_reminder", "Session reminder"),
                            ("weekly_summary", "Weekly summary"),
                            ("deep_work_suggestion", "Deep work suggestion"),
                            ("test", "Test"),
                        ],
                        max_length=32,
                    ),
                ),
                ("title", models.CharField(max_length=160)),
                ("message", models.CharField(max_length=500)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("created", "Created"),
                            ("delivered", "Delivered"),
                            ("failed", "Failed"),
                            ("read", "Read"),
                        ],
                        default="created",
                        max_length=16,
                    ),
                ),
                ("scheduled_for", models.DateTimeField(blank=True, null=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("dedupe_key", models.CharField(max_length=220, unique=True)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("delivered_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="notifications",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["user", "created_at"],
                        name="notificatio_user_id_c62b26_idx",
                    ),
                    models.Index(
                        fields=["user", "notification_type"],
                        name="notificatio_user_id_f77590_idx",
                    ),
                    models.Index(
                        fields=["status", "scheduled_for"],
                        name="notificatio_status_d8d933_idx",
                    ),
                ],
            },
        ),
    ]

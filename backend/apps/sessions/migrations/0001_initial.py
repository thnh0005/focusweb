import apps.sessions.models
import django.db.models.deletion
import django.utils.timezone
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
            name="GoalTemplate",
            fields=[
                (
                    "id",
                    models.CharField(
                        default=apps.sessions.models.custom_template_id,
                        editable=False,
                        max_length=64,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("label", models.CharField(max_length=120)),
                ("text", models.CharField(max_length=500)),
                ("is_built_in", models.BooleanField(default=False)),
                ("usage_count", models.PositiveIntegerField(default=0)),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="goal_templates",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="SessionTag",
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
                ("name", models.CharField(max_length=50)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="session_tags",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="FocusSession",
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
                ("name", models.CharField(blank=True, max_length=160)),
                (
                    "mode",
                    models.CharField(
                        choices=[("normal", "Normal"), ("deep-work", "Deep Work")],
                        max_length=16,
                    ),
                ),
                ("goal", models.CharField(blank=True, max_length=500)),
                ("target_duration_seconds", models.PositiveIntegerField()),
                ("actual_duration_seconds", models.PositiveIntegerField(default=0)),
                ("focus_score", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("focus_state", models.CharField(blank=True, max_length=32)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("active", "Active"),
                            ("paused", "Paused"),
                            ("auto-paused", "Auto Paused"),
                            ("completed", "Completed"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="active",
                        max_length=16,
                    ),
                ),
                ("accumulated_paused_seconds", models.PositiveIntegerField(default=0)),
                ("started_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("paused_at", models.DateTimeField(blank=True, null=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "goal_template",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sessions",
                        to="focus_sessions.goaltemplate",
                    ),
                ),
                (
                    "tags",
                    models.ManyToManyField(
                        blank=True,
                        related_name="sessions",
                        to="focus_sessions.sessiontag",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="focus_sessions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-started_at"]},
        ),
        migrations.CreateModel(
            name="SessionNote",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("content", models.TextField(blank=True, max_length=5000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "session",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="note",
                        to="focus_sessions.focussession",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="SessionStateTransition",
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
                ("from_status", models.CharField(blank=True, max_length=16)),
                (
                    "to_status",
                    models.CharField(
                        choices=[
                            ("active", "Active"),
                            ("paused", "Paused"),
                            ("auto-paused", "Auto Paused"),
                            ("completed", "Completed"),
                            ("cancelled", "Cancelled"),
                        ],
                        max_length=16,
                    ),
                ),
                ("occurred_at", models.DateTimeField(auto_now_add=True)),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="state_transitions",
                        to="focus_sessions.focussession",
                    ),
                ),
            ],
            options={"ordering": ["occurred_at"]},
        ),
        migrations.AddConstraint(
            model_name="goaltemplate",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(("is_built_in", True), ("user__isnull", True)),
                    models.Q(("is_built_in", False), ("user__isnull", False)),
                    _connector="OR",
                ),
                name="goal_template_owner_matches_type",
            ),
        ),
        migrations.AddConstraint(
            model_name="sessiontag",
            constraint=models.UniqueConstraint(
                fields=("user", "name"),
                name="unique_session_tag_per_user",
            ),
        ),
        migrations.AddIndex(
            model_name="focussession",
            index=models.Index(
                fields=["user", "status"],
                name="focus_sessi_user_id_09fbd7_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="focussession",
            index=models.Index(
                fields=["user", "started_at"],
                name="focus_sessi_user_id_d57349_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="focussession",
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ("status__in", ["active", "paused", "auto-paused"])
                ),
                fields=("user",),
                name="one_open_focus_session_per_user",
            ),
        ),
    ]


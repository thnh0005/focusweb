import apps.users.managers
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("password", models.CharField(max_length=128, verbose_name="password")),
                (
                    "last_login",
                    models.DateTimeField(blank=True, null=True, verbose_name="last login"),
                ),
                (
                    "is_superuser",
                    models.BooleanField(
                        default=False,
                        help_text="Designates that this user has all permissions without explicitly assigning them.",
                        verbose_name="superuser status",
                    ),
                ),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("display_name", models.CharField(blank=True, max_length=120)),
                ("avatar_url", models.URLField(blank=True)),
                ("onboarding_complete", models.BooleanField(default=False)),
                ("is_email_verified", models.BooleanField(default=False)),
                ("is_staff", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "groups",
                    models.ManyToManyField(
                        blank=True,
                        help_text="The groups this user belongs to. A user will get all permissions granted to each of their groups.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.group",
                        verbose_name="groups",
                    ),
                ),
                (
                    "user_permissions",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Specific permissions for this user.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.permission",
                        verbose_name="user permissions",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
            managers=[("objects", apps.users.managers.UserManager())],
        ),
        migrations.CreateModel(
            name="OnboardingSurvey",
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
                (
                    "profession",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("student", "Student"),
                            ("developer", "Developer"),
                            ("designer", "Designer"),
                            ("freelancer", "Freelancer"),
                            ("researcher", "Researcher"),
                            ("other", "Other"),
                        ],
                        max_length=24,
                    ),
                ),
                ("learning_domain", models.JSONField(blank=True, default=list)),
                (
                    "preferred_duration_minutes",
                    models.PositiveSmallIntegerField(blank=True, null=True),
                ),
                ("extension_installed", models.BooleanField(default=False)),
                ("skipped", models.BooleanField(default=False)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="onboarding_survey",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Profile",
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
                (
                    "profession",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("student", "Student"),
                            ("developer", "Developer"),
                            ("designer", "Designer"),
                            ("freelancer", "Freelancer"),
                            ("researcher", "Researcher"),
                            ("other", "Other"),
                        ],
                        max_length=24,
                    ),
                ),
                ("learning_domain", models.JSONField(blank=True, default=list)),
                ("streak_count", models.PositiveIntegerField(default=0)),
                ("streak_updated_at", models.DateTimeField(blank=True, null=True)),
                ("total_sessions", models.PositiveIntegerField(default=0)),
                ("total_focus_minutes", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="UserPreference",
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
                (
                    "default_mode",
                    models.CharField(
                        choices=[("normal", "Normal"), ("deep-work", "Deep Work")],
                        default="normal",
                        max_length=16,
                    ),
                ),
                ("default_duration_minutes", models.PositiveSmallIntegerField(default=50)),
                (
                    "theme",
                    models.CharField(
                        choices=[
                            ("cyber", "Cyber"),
                            ("minimal", "Minimal"),
                            ("forest", "Forest"),
                        ],
                        default="forest",
                        max_length=16,
                    ),
                ),
                (
                    "ambient_effect",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("rain", "Rain"),
                            ("snow", "Snow"),
                            ("stars", "Stars"),
                            ("leaves", "Leaves"),
                        ],
                        max_length=16,
                    ),
                ),
                ("notifications_enabled", models.BooleanField(default=True)),
                ("session_reminder_enabled", models.BooleanField(default=False)),
                ("session_reminder_time", models.TimeField(blank=True, null=True)),
                ("weekly_summary_enabled", models.BooleanField(default=True)),
                ("deep_work_suggestion_enabled", models.BooleanField(default=True)),
                ("sound_enabled", models.BooleanField(default=False)),
                ("ambient_sound_volume", models.PositiveSmallIntegerField(default=50)),
                ("extension_installed", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="preferences",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]


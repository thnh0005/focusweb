import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """User đăng nhập bằng email, dùng chung cho auth/session/profile."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=120, blank=True)
    avatar_url = models.URLField(blank=True)
    onboarding_complete = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        self.email = self.email.lower()
        if not self.display_name:
            self.display_name = self.email.split("@", maxsplit=1)[0]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class Profile(models.Model):
    """Thông tin hồ sơ và thống kê tổng hợp phục vụ dashboard cá nhân."""

    class Profession(models.TextChoices):
        STUDENT = "student", "Student"
        DEVELOPER = "developer", "Developer"
        DESIGNER = "designer", "Designer"
        FREELANCER = "freelancer", "Freelancer"
        RESEARCHER = "researcher", "Researcher"
        OTHER = "other", "Other"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    profession = models.CharField(max_length=24, choices=Profession.choices, blank=True)
    learning_domain = models.JSONField(default=list, blank=True)
    streak_count = models.PositiveIntegerField(default=0)
    streak_updated_at = models.DateTimeField(null=True, blank=True)
    total_sessions = models.PositiveIntegerField(default=0)
    total_focus_minutes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile: {self.user.email}"


class UserPreference(models.Model):
    """Cấu hình mặc định của user cho session, giao diện và notification."""

    class SessionMode(models.TextChoices):
        NORMAL = "normal", "Normal"
        DEEP_WORK = "deep-work", "Deep Work"

    class Theme(models.TextChoices):
        CYBER = "cyber", "Cyber"
        MINIMAL = "minimal", "Minimal"
        FOREST = "forest", "Forest"
        MINIMAL_DARK = "minimal-dark", "Minimal Dark"
        AURORA_NIGHT = "aurora-night", "Aurora Night"
        FOREST_CALM = "forest-calm", "Forest Calm"
        RAIN_ROOM = "rain-room", "Rain Room"

    class AmbientEffect(models.TextChoices):
        RAIN = "rain", "Rain"
        SNOW = "snow", "Snow"
        STARS = "stars", "Stars"
        LEAVES = "leaves", "Leaves"

    class MusicTrack(models.TextChoices):
        RAIN = "rain", "Rain"
        FOREST = "forest", "Forest"
        LOFI = "lofi", "Lo-fi"
        WHITE_NOISE = "white-noise", "White Noise"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="preferences",
    )
    default_mode = models.CharField(
        max_length=16,
        choices=SessionMode.choices,
        default=SessionMode.NORMAL,
    )
    default_duration_minutes = models.PositiveSmallIntegerField(default=50)
    theme = models.CharField(max_length=16, choices=Theme.choices, default=Theme.FOREST)
    ambient_effect = models.CharField(
        max_length=16,
        choices=AmbientEffect.choices,
        blank=True,
    )
    notifications_enabled = models.BooleanField(default=True)
    session_reminder_enabled = models.BooleanField(default=False)
    session_reminder_time = models.TimeField(null=True, blank=True)
    weekly_summary_enabled = models.BooleanField(default=True)
    deep_work_suggestion_enabled = models.BooleanField(default=True)
    sound_enabled = models.BooleanField(default=False)
    ambient_sound_volume = models.PositiveSmallIntegerField(default=50)
    music_enabled = models.BooleanField(default=True)
    music_track = models.CharField(
        max_length=24,
        choices=MusicTrack.choices,
        default=MusicTrack.RAIN,
    )
    custom_playlist_url = models.URLField(blank=True)
    ambient_effect_enabled = models.BooleanField(default=True)
    ambient_effect_intensity = models.PositiveSmallIntegerField(default=50)
    theme_accent = models.CharField(max_length=24, default="moss", blank=True)
    workspace_background_url = models.URLField(blank=True)
    auto_resume_session = models.BooleanField(default=False)
    extension_installed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Preferences: {self.user.email}"


class OnboardingSurvey(models.Model):
    """Lưu câu trả lời onboarding để biết user đã hoàn tất setup ban đầu."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="onboarding_survey",
    )
    profession = models.CharField(
        max_length=24,
        choices=Profile.Profession.choices,
        blank=True,
    )
    learning_domain = models.JSONField(default=list, blank=True)
    preferred_duration_minutes = models.PositiveSmallIntegerField(null=True, blank=True)
    extension_installed = models.BooleanField(default=False)
    skipped = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Onboarding: {self.user.email}"


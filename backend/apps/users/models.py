import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.db.models import Q

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
        NONE = "none", "None"
        LOFI = "lofi", "Lo-fi"
        RAIN = "rain", "Rain"
        FOREST = "forest", "Forest"
        CAFE = "cafe", "Cafe"
        WHITE_NOISE = "white_noise", "White Noise"

    class MusicPlaylistProvider(models.TextChoices):
        NONE = "none", "None"
        SPOTIFY = "spotify", "Spotify"
        YOUTUBE_MUSIC = "youtube_music", "YouTube Music"
        DIRECT_AUDIO = "direct_audio", "Direct Audio"
        EXTERNAL = "external", "External"

    class Language(models.TextChoices):
        VI = "vi", "Vietnamese"
        EN = "en", "English"

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
    music_enabled = models.BooleanField(default=False)
    music_track = models.CharField(
        max_length=24,
        choices=MusicTrack.choices,
        default=MusicTrack.NONE,
    )
    music_autoplay = models.BooleanField(default=False)
    use_custom_playlist = models.BooleanField(default=False)
    custom_playlist_url = models.URLField(blank=True, max_length=2048)
    custom_playlist_provider = models.CharField(
        max_length=24,
        choices=MusicPlaylistProvider.choices,
        default=MusicPlaylistProvider.NONE,
    )
    ambient_effect_enabled = models.BooleanField(default=True)
    ambient_effect_intensity = models.PositiveSmallIntegerField(default=50)
    theme_accent = models.CharField(max_length=24, default="moss", blank=True)
    workspace_background_url = models.URLField(blank=True)
    auto_resume_session = models.BooleanField(default=False)
    extension_installed = models.BooleanField(default=False)
    language = models.CharField(
        max_length=2,
        choices=Language.choices,
        default=Language.VI,
    )
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


class AccountDataExportJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        EXPIRED = "expired", "Expired"
        CANCELLED = "cancelled", "Cancelled"

    class Format(models.TextChoices):
        ZIP = "zip", "ZIP"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="account_export_jobs",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    export_format = models.CharField(
        max_length=8,
        choices=Format.choices,
        default=Format.ZIP,
    )
    file = models.FileField(upload_to="account-exports/", max_length=255, blank=True)
    file_size = models.PositiveIntegerField(default=0)
    checksum = models.CharField(max_length=64, blank=True)
    progress = models.PositiveSmallIntegerField(default=0)
    requested_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.CharField(max_length=255, blank=True)
    export_version = models.CharField(max_length=16, default="day26-v1")
    generation_fingerprint = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
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
                condition=Q(progress__gte=0, progress__lte=100),
                name="account_export_progress_between_0_100",
            ),
            models.UniqueConstraint(
                fields=["user", "generation_fingerprint"],
                condition=~Q(generation_fingerprint=""),
                name="unique_account_export_fingerprint_per_user",
            ),
        ]

    def __str__(self):
        return f"{self.user_id}: {self.status}"


class AccountDeletionJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        CANCELLED = "cancelled", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="account_deletion_jobs",
        null=True,
        blank=True,
    )
    user_identifier_snapshot = models.CharField(max_length=64, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    confirmed = models.BooleanField(default=False)
    requested_at = models.DateTimeField(auto_now_add=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status_token_hash = models.CharField(max_length=64, blank=True)
    status_token_expires_at = models.DateTimeField(null=True, blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.CharField(max_length=255, blank=True)
    deletion_version = models.CharField(max_length=16, default="day26-v1")
    audit_summary = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status", "scheduled_for"]),
            models.Index(fields=["status_token_expires_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=Q(status__in=["pending", "processing"]),
                name="unique_active_account_deletion_job_per_user",
            ),
        ]

    def __str__(self):
        return f"{self.user_identifier_snapshot or self.user_id}: {self.status}"


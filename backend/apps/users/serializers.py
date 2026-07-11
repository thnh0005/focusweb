from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

from .models import (
    AccountDataExportJob,
    AccountDeletionJob,
    OnboardingSurvey,
    Profile,
    User,
    UserPreference,
)
from .services import MusicProviderDetector


class CsrfTokenSerializer(serializers.Serializer):
    csrfToken = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    displayName = serializers.CharField(source="display_name", read_only=True)
    avatarUrl = serializers.URLField(source="avatar_url", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    onboardingComplete = serializers.BooleanField(
        source="onboarding_complete",
        read_only=True,
    )
    isEmailVerified = serializers.BooleanField(
        source="is_email_verified",
        read_only=True,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "displayName",
            "avatarUrl",
            "createdAt",
            "onboardingComplete",
            "isEmailVerified",
        ]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    passwordConfirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["passwordConfirm"]:
            raise serializers.ValidationError(
                {"passwordConfirm": ["Passwords do not match."]}
            )

        try:
            validate_password(attrs["password"], user=User(email=attrs["email"]))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs

    def create(self, validated_data):
        validated_data.pop("passwordConfirm")
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            email=attrs["email"].lower(),
            password=attrs["password"],
        )
        if user is None or not user.is_active:
            raise serializers.ValidationError("Invalid credentials.")
        attrs["user"] = user
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower()

    def get_user(self):
        return User.objects.filter(
            email__iexact=self.validated_data["email"],
            is_active=True,
        ).first()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True, trim_whitespace=False)
    uid = serializers.CharField(required=False, write_only=True, allow_blank=True)
    uidb64 = serializers.CharField(required=False, write_only=True, allow_blank=True)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": ["Passwords do not match."]}
            )

        user = self.get_user_from_signed_token(attrs["token"])
        if user is None:
            user = self.get_user_from_django_token(attrs)
        if user is None or not user.is_active:
            raise serializers.ValidationError({"token": ["Reset token is invalid or expired."]})

        try:
            validate_password(attrs["new_password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)}) from exc

        attrs["user"] = user
        return attrs

    @staticmethod
    def get_user_from_signed_token(token):
        signer = signing.TimestampSigner(salt="focusos.password-reset")
        max_age = getattr(settings, "PASSWORD_RESET_TIMEOUT", 60 * 60 * 24)
        try:
            user_id = signer.unsign(token, max_age=max_age)
        except (signing.BadSignature, signing.SignatureExpired):
            return None
        return User.objects.filter(pk=user_id).first()

    @staticmethod
    def get_user_from_django_token(attrs):
        uid = attrs.get("uidb64") or attrs.get("uid")
        token = attrs["token"]
        if not uid and ":" in token:
            uid, token = token.split(":", 1)
        if not uid:
            return None
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.filter(pk=user_id).first()
        except (TypeError, ValueError, OverflowError):
            return None
        if user and default_token_generator.check_token(user, token):
            return user
        return None


class ProfileSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    displayName = serializers.CharField(
        source="user.display_name",
        required=False,
        allow_blank=True,
        max_length=120,
    )
    avatarUrl = serializers.URLField(
        source="user.avatar_url",
        required=False,
        allow_blank=True,
    )
    createdAt = serializers.DateTimeField(source="user.created_at", read_only=True)
    onboardingComplete = serializers.BooleanField(
        source="user.onboarding_complete",
        read_only=True,
    )
    isEmailVerified = serializers.BooleanField(
        source="user.is_email_verified",
        read_only=True,
    )
    learningDomain = serializers.ListField(
        source="learning_domain",
        child=serializers.CharField(max_length=120),
        required=False,
        max_length=20,
    )
    streakCount = serializers.IntegerField(source="streak_count", read_only=True)
    streakUpdatedAt = serializers.DateTimeField(
        source="streak_updated_at",
        read_only=True,
    )
    totalSessions = serializers.IntegerField(source="total_sessions", read_only=True)
    totalFocusMinutes = serializers.IntegerField(
        source="total_focus_minutes",
        read_only=True,
    )

    class Meta:
        model = Profile
        fields = [
            "id",
            "email",
            "displayName",
            "avatarUrl",
            "createdAt",
            "onboardingComplete",
            "isEmailVerified",
            "profession",
            "learningDomain",
            "streakCount",
            "streakUpdatedAt",
            "totalSessions",
            "totalFocusMinutes",
        ]

    @transaction.atomic
    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        for field, value in user_data.items():
            setattr(instance.user, field, value)
        if user_data:
            instance.user.save()
        return super().update(instance, validated_data)


class UserPreferenceSerializer(serializers.ModelSerializer):
    defaultMode = serializers.ChoiceField(
        source="default_mode",
        choices=UserPreference.SessionMode.choices,
        required=False,
    )
    defaultDurationMinutes = serializers.IntegerField(
        source="default_duration_minutes",
        min_value=1,
        max_value=480,
        required=False,
    )
    ambientEffect = serializers.ChoiceField(
        source="ambient_effect",
        choices=[("", "None"), *UserPreference.AmbientEffect.choices],
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    notificationsEnabled = serializers.BooleanField(
        source="notifications_enabled",
        required=False,
    )
    sessionReminderEnabled = serializers.BooleanField(
        source="session_reminder_enabled",
        required=False,
    )
    sessionReminderTime = serializers.TimeField(
        source="session_reminder_time",
        required=False,
        allow_null=True,
        format="%H:%M",
        input_formats=["%H:%M", "%H:%M:%S"],
    )
    weeklySummaryEnabled = serializers.BooleanField(
        source="weekly_summary_enabled",
        required=False,
    )
    deepWorkSuggestionEnabled = serializers.BooleanField(
        source="deep_work_suggestion_enabled",
        required=False,
    )
    soundEnabled = serializers.BooleanField(source="sound_enabled", required=False)
    ambientSoundVolume = serializers.IntegerField(
        source="ambient_sound_volume",
        min_value=0,
        max_value=100,
        required=False,
    )
    musicEnabled = serializers.BooleanField(source="music_enabled", required=False)
    musicTrack = serializers.ChoiceField(
        source="music_track",
        choices=UserPreference.MusicTrack.choices,
        required=False,
    )
    customPlaylistUrl = serializers.URLField(
        source="custom_playlist_url",
        required=False,
        allow_blank=True,
    )
    musicAutoplay = serializers.BooleanField(source="music_autoplay", required=False)
    useCustomPlaylist = serializers.BooleanField(
        source="use_custom_playlist",
        required=False,
    )
    customPlaylistProvider = serializers.ChoiceField(
        source="custom_playlist_provider",
        choices=UserPreference.MusicPlaylistProvider.choices,
        required=False,
    )
    ambientEffectEnabled = serializers.BooleanField(
        source="ambient_effect_enabled",
        required=False,
    )
    ambientEffectIntensity = serializers.IntegerField(
        source="ambient_effect_intensity",
        min_value=0,
        max_value=100,
        required=False,
    )
    themeAccent = serializers.CharField(
        source="theme_accent",
        required=False,
        allow_blank=True,
        max_length=24,
    )
    workspaceBackgroundUrl = serializers.URLField(
        source="workspace_background_url",
        required=False,
        allow_blank=True,
    )
    autoResumeSession = serializers.BooleanField(
        source="auto_resume_session",
        required=False,
    )
    goalTemplates = serializers.SerializerMethodField()
    customBlacklist = serializers.SerializerMethodField()

    class Meta:
        model = UserPreference
        fields = [
            "defaultMode",
            "defaultDurationMinutes",
            "theme",
            "ambientEffect",
            "notificationsEnabled",
            "sessionReminderEnabled",
            "sessionReminderTime",
            "weeklySummaryEnabled",
            "deepWorkSuggestionEnabled",
            "goalTemplates",
            "customBlacklist",
            "soundEnabled",
            "ambientSoundVolume",
            "musicEnabled",
            "musicTrack",
            "customPlaylistUrl",
            "musicAutoplay",
            "useCustomPlaylist",
            "customPlaylistProvider",
            "ambientEffectEnabled",
            "ambientEffectIntensity",
            "themeAccent",
            "workspaceBackgroundUrl",
            "autoResumeSession",
        ]
        extra_kwargs = {"theme": {"required": False}}

    def validate_ambientEffect(self, value):
        return value or ""

    def get_goalTemplates(self, instance) -> list[dict]:
        from apps.sessions.models import GoalTemplate
        from apps.sessions.serializers import GoalTemplateSerializer

        templates = GoalTemplate.objects.available_to(instance.user)
        return GoalTemplateSerializer(templates, many=True).data

    def get_customBlacklist(self, instance) -> list[str]:
        return []


class NotificationSettingsSerializer(serializers.ModelSerializer):
    notificationsEnabled = serializers.BooleanField(
        source="notifications_enabled",
        required=False,
    )
    sessionReminderEnabled = serializers.BooleanField(
        source="session_reminder_enabled",
        required=False,
    )
    sessionReminderTime = serializers.TimeField(
        source="session_reminder_time",
        required=False,
        allow_null=True,
        format="%H:%M",
        input_formats=["%H:%M", "%H:%M:%S"],
    )
    weeklySummaryEnabled = serializers.BooleanField(
        source="weekly_summary_enabled",
        required=False,
    )
    deepWorkSuggestionEnabled = serializers.BooleanField(
        source="deep_work_suggestion_enabled",
        required=False,
    )

    class Meta:
        model = UserPreference
        fields = [
            "notificationsEnabled",
            "sessionReminderEnabled",
            "sessionReminderTime",
            "weeklySummaryEnabled",
            "deepWorkSuggestionEnabled",
        ]


class MusicPreferenceSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False)
    built_in_track = serializers.ChoiceField(
        choices=UserPreference.MusicTrack.choices,
        required=False,
    )
    volume = serializers.IntegerField(min_value=0, max_value=100, required=False)
    autoplay = serializers.BooleanField(required=False)
    use_custom_playlist = serializers.BooleanField(required=False)
    custom_playlist_url = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=2048,
    )
    custom_playlist_provider = serializers.ChoiceField(
        choices=UserPreference.MusicPlaylistProvider.choices,
        required=False,
    )
    musicEnabled = serializers.BooleanField(required=False, write_only=True)
    musicTrack = serializers.CharField(required=False, write_only=True)
    customPlaylistUrl = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=2048,
        write_only=True,
    )
    soundEnabled = serializers.BooleanField(required=False)
    ambientSoundVolume = serializers.IntegerField(
        min_value=0,
        max_value=100,
        required=False,
        write_only=True,
    )
    musicAutoplay = serializers.BooleanField(required=False, write_only=True)
    useCustomPlaylist = serializers.BooleanField(required=False, write_only=True)
    customPlaylistProvider = serializers.CharField(required=False, write_only=True)

    LEGACY_TRACK_ALIASES = {"white-noise": UserPreference.MusicTrack.WHITE_NOISE}

    def to_internal_value(self, data):
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {field: ["Unknown music preference field."] for field in sorted(unknown)}
            )
        for field in ("volume", "ambientSoundVolume"):
            if field in data and (
                isinstance(data[field], bool) or not isinstance(data[field], int)
            ):
                raise serializers.ValidationError(
                    {field: ["Volume must be an integer from 0 to 100."]}
                )
        return super().to_internal_value(data)

    def validate(self, attrs):
        instance = self.instance
        current = {
            "enabled": instance.music_enabled,
            "built_in_track": self.normalize_track(instance.music_track),
            "volume": instance.ambient_sound_volume,
            "autoplay": instance.music_autoplay,
            "use_custom_playlist": instance.use_custom_playlist,
            "custom_playlist_url": instance.custom_playlist_url,
            "custom_playlist_provider": instance.custom_playlist_provider,
            "sound_enabled": instance.sound_enabled,
        }

        preferences = {
            "enabled": attrs.get("enabled", attrs.get("musicEnabled", current["enabled"])),
            "built_in_track": attrs.get(
                "built_in_track",
                attrs.get("musicTrack", current["built_in_track"]),
            ),
            "volume": attrs.get(
                "volume",
                attrs.get("ambientSoundVolume", current["volume"]),
            ),
            "autoplay": attrs.get(
                "autoplay",
                attrs.get("musicAutoplay", current["autoplay"]),
            ),
            "use_custom_playlist": attrs.get(
                "use_custom_playlist",
                attrs.get("useCustomPlaylist", current["use_custom_playlist"]),
            ),
            "custom_playlist_url": attrs.get(
                "custom_playlist_url",
                attrs.get("customPlaylistUrl", current["custom_playlist_url"]),
            ),
            "custom_playlist_provider": attrs.get(
                "custom_playlist_provider",
                attrs.get(
                    "customPlaylistProvider",
                    current["custom_playlist_provider"],
                ),
            ),
            "sound_enabled": attrs.get("soundEnabled", current["sound_enabled"]),
        }

        preferences["built_in_track"] = self.normalize_track(
            preferences["built_in_track"]
        )
        valid_providers = {
            choice[0] for choice in UserPreference.MusicPlaylistProvider.choices
        }
        if preferences["custom_playlist_provider"] not in valid_providers:
            raise serializers.ValidationError(
                {"custom_playlist_provider": ["Unsupported custom playlist provider."]}
            )
        if preferences["enabled"] and not preferences["use_custom_playlist"]:
            if preferences["built_in_track"] == UserPreference.MusicTrack.NONE:
                raise serializers.ValidationError(
                    {
                        "built_in_track": [
                            "Choose a built-in track when music is enabled."
                        ]
                    }
                )

        url = (preferences["custom_playlist_url"] or "").strip()
        provider = preferences["custom_playlist_provider"]
        provider_key_sent = (
            "custom_playlist_provider" in self.initial_data
            or "customPlaylistProvider" in self.initial_data
        )
        if url:
            try:
                normalized_url = MusicProviderDetector.validate_custom_url(url)
                detected_provider = MusicProviderDetector.detect_provider(normalized_url)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"custom_playlist_url": exc.detail})
            if (
                provider
                and provider != UserPreference.MusicPlaylistProvider.NONE
                and provider != detected_provider
            ):
                raise serializers.ValidationError(
                    {
                        "custom_playlist_provider": [
                            "Playlist provider does not match the URL."
                        ]
                    }
                )
            preferences["custom_playlist_url"] = normalized_url
            preferences["custom_playlist_provider"] = detected_provider
        elif preferences["use_custom_playlist"]:
            raise serializers.ValidationError(
                {"custom_playlist_url": ["Custom playlist URL is required."]}
            )
        elif "custom_playlist_url" in attrs or "customPlaylistUrl" in attrs:
            preferences["custom_playlist_provider"] = (
                UserPreference.MusicPlaylistProvider.NONE
            )

        if (
            preferences["use_custom_playlist"]
            and provider_key_sent
            and provider == UserPreference.MusicPlaylistProvider.NONE
        ):
            raise serializers.ValidationError(
                {
                    "custom_playlist_provider": [
                        "Custom playlist provider must be identified."
                    ]
                }
            )

        return preferences

    def update(self, instance, validated_data):
        instance.music_enabled = validated_data["enabled"]
        instance.music_track = validated_data["built_in_track"]
        instance.ambient_sound_volume = validated_data["volume"]
        instance.music_autoplay = validated_data["autoplay"]
        instance.use_custom_playlist = validated_data["use_custom_playlist"]
        instance.custom_playlist_url = validated_data["custom_playlist_url"]
        instance.custom_playlist_provider = validated_data["custom_playlist_provider"]
        instance.sound_enabled = validated_data["sound_enabled"]
        instance.save(
            update_fields=[
                "music_enabled",
                "music_track",
                "ambient_sound_volume",
                "music_autoplay",
                "use_custom_playlist",
                "custom_playlist_url",
                "custom_playlist_provider",
                "sound_enabled",
                "updated_at",
            ]
        )
        return instance

    def to_representation(self, instance):
        track = self.normalize_track(instance.music_track)
        custom_url = instance.custom_playlist_url or None
        source = "custom_playlist" if instance.use_custom_playlist else "built_in"
        data = {
            "enabled": instance.music_enabled,
            "source": source,
            "built_in_track": track,
            "volume": instance.ambient_sound_volume,
            "autoplay": instance.music_autoplay,
            "use_custom_playlist": instance.use_custom_playlist,
            "custom_playlist_url": custom_url,
            "custom_playlist_provider": instance.custom_playlist_provider,
            "custom_playlist": {
                "enabled": instance.use_custom_playlist,
                "url": custom_url,
                "provider": instance.custom_playlist_provider,
            },
            "updated_at": instance.updated_at,
            "musicEnabled": instance.music_enabled,
            "musicTrack": track,
            "customPlaylistUrl": custom_url,
            "soundEnabled": instance.sound_enabled,
            "ambientSoundVolume": instance.ambient_sound_volume,
        }
        return data

    def normalize_track(self, value):
        normalized = self.LEGACY_TRACK_ALIASES.get(value, value)
        valid_tracks = {choice[0] for choice in UserPreference.MusicTrack.choices}
        if normalized not in valid_tracks:
            raise serializers.ValidationError(
                {"built_in_track": ["Unsupported built-in music track."]}
            )
        return normalized


class ThemePreferenceSerializer(serializers.ModelSerializer):
    themeAccent = serializers.CharField(
        source="theme_accent",
        required=False,
        allow_blank=True,
        max_length=24,
    )
    workspaceBackgroundUrl = serializers.URLField(
        source="workspace_background_url",
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = UserPreference
        fields = ["theme", "themeAccent", "workspaceBackgroundUrl"]
        extra_kwargs = {"theme": {"required": False}}


class AmbientPreferenceSerializer(serializers.ModelSerializer):
    ambientEffect = serializers.ChoiceField(
        source="ambient_effect",
        choices=[("", "None"), *UserPreference.AmbientEffect.choices],
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    ambientEffectEnabled = serializers.BooleanField(
        source="ambient_effect_enabled",
        required=False,
    )
    ambientEffectIntensity = serializers.IntegerField(
        source="ambient_effect_intensity",
        min_value=0,
        max_value=100,
        required=False,
    )

    class Meta:
        model = UserPreference
        fields = [
            "ambientEffect",
            "ambientEffectEnabled",
            "ambientEffectIntensity",
        ]

    def validate_ambientEffect(self, value):
        return value or ""


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(write_only=True, trim_whitespace=False)
    newPassword = serializers.CharField(write_only=True, trim_whitespace=False)
    newPasswordConfirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["currentPassword"]):
            raise serializers.ValidationError(
                {"currentPassword": ["Current password is incorrect."]}
            )
        if attrs["newPassword"] != attrs["newPasswordConfirm"]:
            raise serializers.ValidationError(
                {"newPasswordConfirm": ["Passwords do not match."]}
            )
        try:
            validate_password(attrs["newPassword"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"newPassword": list(exc.messages)}) from exc
        return attrs


class DeleteAccountSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_currentPassword(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


class AccountExportSerializer(serializers.Serializer):
    generatedAt = serializers.DateTimeField()
    user = serializers.DictField()
    profile = serializers.DictField()
    preferences = serializers.DictField()
    sessions = serializers.ListField(child=serializers.DictField())
    documents = serializers.ListField(child=serializers.DictField())


class AccountDataExportJobSerializer(serializers.ModelSerializer):
    jobId = serializers.UUIDField(source="id", read_only=True)
    format = serializers.CharField(source="export_format", read_only=True)
    downloadUrl = serializers.SerializerMethodField()
    downloadReady = serializers.SerializerMethodField()
    fileSize = serializers.IntegerField(source="file_size", read_only=True)
    errorCode = serializers.CharField(source="error_code", read_only=True)
    errorMessage = serializers.CharField(source="error_message", read_only=True)
    requestedAt = serializers.DateTimeField(source="requested_at", read_only=True)
    startedAt = serializers.DateTimeField(source="started_at", read_only=True)
    completedAt = serializers.DateTimeField(source="completed_at", read_only=True)
    expiresAt = serializers.DateTimeField(source="expires_at", read_only=True)

    class Meta:
        model = AccountDataExportJob
        fields = [
            "jobId",
            "status",
            "format",
            "downloadUrl",
            "downloadReady",
            "fileSize",
            "checksum",
            "progress",
            "errorCode",
            "errorMessage",
            "requestedAt",
            "startedAt",
            "completedAt",
            "expiresAt",
        ]

    def get_downloadUrl(self, obj):
        if obj.status == AccountDataExportJob.Status.COMPLETED and obj.file:
            return obj.file.url
        return ""

    def get_downloadReady(self, obj):
        return obj.status == AccountDataExportJob.Status.COMPLETED and bool(obj.file)


class AccountDeletionJobSerializer(serializers.ModelSerializer):
    jobId = serializers.UUIDField(source="id", read_only=True)
    errorCode = serializers.CharField(source="error_code", read_only=True)
    errorMessage = serializers.CharField(source="error_message", read_only=True)
    requestedAt = serializers.DateTimeField(source="requested_at", read_only=True)
    scheduledFor = serializers.DateTimeField(source="scheduled_for", read_only=True)
    startedAt = serializers.DateTimeField(source="started_at", read_only=True)
    completedAt = serializers.DateTimeField(source="completed_at", read_only=True)

    class Meta:
        model = AccountDeletionJob
        fields = [
            "jobId",
            "status",
            "confirmed",
            "errorCode",
            "errorMessage",
            "requestedAt",
            "scheduledFor",
            "startedAt",
            "completedAt",
        ]


class AccountDeletionReceiptSerializer(serializers.ModelSerializer):
    jobId = serializers.UUIDField(source="id", read_only=True)
    statusToken = serializers.SerializerMethodField()
    statusExpiresAt = serializers.DateTimeField(
        source="status_token_expires_at",
        read_only=True,
    )
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    startedAt = serializers.DateTimeField(source="started_at", read_only=True)
    completedAt = serializers.DateTimeField(source="completed_at", read_only=True)

    class Meta:
        model = AccountDeletionJob
        fields = [
            "jobId",
            "status",
            "statusToken",
            "createdAt",
            "startedAt",
            "completedAt",
            "statusExpiresAt",
        ]

    def get_statusToken(self, obj):
        return self.context.get("status_token", "")


class AccountDeletionStatusSerializer(serializers.ModelSerializer):
    jobId = serializers.UUIDField(source="id", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    startedAt = serializers.DateTimeField(source="started_at", read_only=True)
    completedAt = serializers.DateTimeField(source="completed_at", read_only=True)
    statusExpiresAt = serializers.DateTimeField(
        source="status_token_expires_at",
        read_only=True,
    )
    errorCode = serializers.SerializerMethodField()
    errorMessage = serializers.SerializerMethodField()

    class Meta:
        model = AccountDeletionJob
        fields = [
            "jobId",
            "status",
            "createdAt",
            "startedAt",
            "completedAt",
            "statusExpiresAt",
            "errorCode",
            "errorMessage",
        ]

    def get_errorCode(self, obj):
        if obj.status == AccountDeletionJob.Status.FAILED:
            return obj.error_code or "ACCOUNT_DELETION_FAILED"
        return ""

    def get_errorMessage(self, obj):
        if obj.status == AccountDeletionJob.Status.FAILED:
            return "Account deletion failed."
        return ""


class StreakSerializer(serializers.Serializer):
    currentStreak = serializers.IntegerField()
    longestStreak = serializers.IntegerField()
    lastSessionDate = serializers.DateField(allow_null=True)
    milestoneReached = serializers.IntegerField(allow_null=True)
    milestones = serializers.ListField(child=serializers.DictField())


class OnboardingSerializer(serializers.Serializer):
    profession = serializers.ChoiceField(
        choices=Profile.Profession.choices,
        required=False,
        allow_blank=True,
    )
    learningDomain = serializers.ListField(
        child=serializers.CharField(max_length=120),
        required=False,
        max_length=20,
    )
    preferredDurationMinutes = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=480,
    )
    extensionInstalled = serializers.BooleanField(required=False)
    skipped = serializers.BooleanField(required=False, default=False)

    @transaction.atomic
    def save(self, **kwargs):
        user = self.context["request"].user
        survey = user.onboarding_survey
        profile = user.profile
        preferences = user.preferences
        data = self.validated_data

        if "profession" in data:
            survey.profession = data["profession"]
            profile.profession = data["profession"]
        if "learningDomain" in data:
            survey.learning_domain = data["learningDomain"]
            profile.learning_domain = data["learningDomain"]
        if "preferredDurationMinutes" in data:
            survey.preferred_duration_minutes = data["preferredDurationMinutes"]
            preferences.default_duration_minutes = data["preferredDurationMinutes"]
        if "extensionInstalled" in data:
            survey.extension_installed = data["extensionInstalled"]
            preferences.extension_installed = data["extensionInstalled"]

        survey.skipped = data["skipped"]
        survey.completed_at = timezone.now()
        user.onboarding_complete = True

        survey.save()
        profile.save()
        preferences.save()
        user.save(update_fields=["onboarding_complete", "updated_at"])
        return survey

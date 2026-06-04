from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import OnboardingSurvey, Profile, User, UserPreference


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

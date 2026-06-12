from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import serializers

from .models import FocusSession, GoalTemplate, SessionNote, SessionStateTransition
from .services import set_session_tags


class GoalTemplateSerializer(serializers.ModelSerializer):
    isBuiltIn = serializers.BooleanField(source="is_built_in", read_only=True)
    usageCount = serializers.IntegerField(source="usage_count", read_only=True)
    lastUsedAt = serializers.DateTimeField(source="last_used_at", read_only=True)

    class Meta:
        model = GoalTemplate
        fields = ["id", "label", "text", "isBuiltIn", "usageCount", "lastUsedAt"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        instance = self.instance
        if instance and instance.is_built_in:
            raise serializers.ValidationError("Built-in templates cannot be changed.")
        return attrs


class SessionSerializer(serializers.ModelSerializer):
    userId = serializers.UUIDField(source="user_id", read_only=True)
    tags = serializers.SlugRelatedField(many=True, slug_field="name", read_only=True)
    note = serializers.SerializerMethodField()
    targetDurationSeconds = serializers.IntegerField(
        source="target_duration_seconds",
        read_only=True,
    )
    actualDurationSeconds = serializers.IntegerField(
        source="actual_duration_seconds",
        read_only=True,
    )
    focusScore = serializers.IntegerField(source="focus_score", read_only=True)
    focusState = serializers.CharField(source="focus_state", read_only=True)
    startedAt = serializers.DateTimeField(source="started_at", read_only=True)
    endedAt = serializers.DateTimeField(source="ended_at", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = FocusSession
        fields = [
            "id",
            "userId",
            "name",
            "mode",
            "goal",
            "tags",
            "note",
            "targetDurationSeconds",
            "actualDurationSeconds",
            "focusScore",
            "focusState",
            "status",
            "startedAt",
            "endedAt",
            "createdAt",
        ]

    def get_note(self, instance) -> str:
        try:
            return instance.note.content
        except SessionNote.DoesNotExist:
            return ""


class ActiveSessionSerializer(serializers.ModelSerializer):
    userId = serializers.UUIDField(source="user_id", read_only=True)
    tags = serializers.SlugRelatedField(many=True, slug_field="name", read_only=True)
    targetDurationSeconds = serializers.IntegerField(
        source="target_duration_seconds",
        read_only=True,
    )
    startedAt = serializers.DateTimeField(source="started_at", read_only=True)

    class Meta:
        model = FocusSession
        fields = [
            "id",
            "userId",
            "mode",
            "goal",
            "tags",
            "targetDurationSeconds",
            "startedAt",
            "status",
        ]


class CreateSessionSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True, max_length=160)
    mode = serializers.ChoiceField(choices=FocusSession.Mode.choices)
    goal = serializers.CharField(required=False, allow_blank=True, max_length=500)
    goalTemplateId = serializers.CharField(
        source="goal_template_id",
        required=False,
        allow_blank=True,
        max_length=64,
    )
    targetDurationSeconds = serializers.IntegerField(
        source="target_duration_seconds",
        min_value=60,
        max_value=28800,
    )
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        max_length=3,
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=5000)

    def validate(self, attrs):
        request = self.context["request"]
        template_id = attrs.get("goal_template_id")
        template = None
        if template_id:
            template = GoalTemplate.objects.available_to(request.user).filter(
                pk=template_id
            ).first()
            if template is None:
                raise serializers.ValidationError(
                    {"goalTemplateId": ["Goal template was not found."]}
                )
            attrs["goal_template"] = template
            if not attrs.get("goal", "").strip():
                attrs["goal"] = template.text

        attrs["goal"] = attrs.get("goal", "").strip()
        if attrs["mode"] == FocusSession.Mode.DEEP_WORK and not attrs["goal"]:
            raise serializers.ValidationError(
                {"goal": ["Deep Work sessions require a goal."]}
            )
        if FocusSession.objects.filter(
            user=request.user,
            status__in=FocusSession.OPEN_STATUSES,
        ).exists():
            raise serializers.ValidationError(
                {"status": ["Finish or cancel the current session before starting another."]}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user = self.context["request"].user
        tag_names = validated_data.pop("tags", [])
        note = validated_data.pop("note", None)
        template = validated_data.pop("goal_template", None)
        validated_data.pop("goal_template_id", None)

        try:
            session = FocusSession.objects.create(
                user=user,
                goal_template=template,
                **validated_data,
            )
        except IntegrityError as exc:
            raise serializers.ValidationError(
                {"status": ["An open session already exists."]}
            ) from exc

        set_session_tags(session, tag_names)
        if note is not None:
            SessionNote.objects.create(session=session, content=note)
        SessionStateTransition.objects.create(
            session=session,
            from_status="",
            to_status=FocusSession.Status.ACTIVE,
        )

        if template:
            GoalTemplate.objects.filter(pk=template.pk).update(
                usage_count=F("usage_count") + 1,
                last_used_at=timezone.now(),
            )
        return session


class UpdateSessionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            FocusSession.Status.ACTIVE,
            FocusSession.Status.PAUSED,
            FocusSession.Status.AUTO_PAUSED,
        ],
        required=False,
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        max_length=3,
    )


class EndSessionSerializer(serializers.Serializer):
    actualDurationSeconds = serializers.IntegerField(required=False, min_value=0)
    note = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        max_length=3,
    )


class SmartPresetSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=FocusSession.Mode.choices)
    durationMinutes = serializers.IntegerField(min_value=1, max_value=480)
    rationale = serializers.CharField()
    confidence = serializers.FloatField(min_value=0, max_value=1)


class FocusScoreBreakdownSerializer(serializers.Serializer):
    contentRelevance = serializers.FloatField()
    focusContinuity = serializers.FloatField()
    tabStability = serializers.FloatField()
    distractionPenalty = serializers.FloatField()
    total = serializers.FloatField()


class SessionSummarySerializer(serializers.Serializer):
    session = SessionSerializer()
    scoreBreakdown = FocusScoreBreakdownSerializer(allow_null=True)
    scoreMetadata = serializers.DictField()
    aiInsights = serializers.ListField(child=serializers.CharField())
    distractionEvents = serializers.ListField(child=serializers.DictField())
    warningLog = serializers.ListField(child=serializers.DictField())
    recommendation = serializers.CharField()
    isAiInsightReady = serializers.BooleanField()


class RealtimeScoreResponseSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    session_status = serializers.CharField()
    score = serializers.IntegerField(allow_null=True)
    label = serializers.CharField(allow_null=True)
    components = serializers.DictField()
    weights = serializers.DictField(required=False)
    window_seconds = serializers.IntegerField(required=False)
    event_count = serializers.IntegerField()
    data_quality = serializers.CharField()
    stale = serializers.BooleanField()
    ai_status = serializers.CharField(required=False)
    ai_error_code = serializers.CharField(allow_null=True, required=False)
    calculated_at = serializers.DateTimeField(required=False)


class WarningCycleSummarySerializer(serializers.Serializer):
    cycle_id = serializers.UUIDField()
    status = serializers.CharField()
    current_level = serializers.IntegerField()
    decision_source = serializers.CharField(allow_blank=True, required=False)
    next_warning_at = serializers.DateTimeField(allow_null=True)
    auto_pause_required = serializers.BooleanField()
    started_at = serializers.DateTimeField()
    resolved_at = serializers.DateTimeField(allow_null=True)


class SessionWarningEntrySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    cycle_id = serializers.UUIDField(allow_null=True)
    level = serializers.IntegerField()
    decision_state = serializers.CharField(allow_blank=True)
    decision_source = serializers.CharField(allow_blank=True, required=False)
    decision_score = serializers.IntegerField(allow_null=True)
    domain = serializers.CharField(allow_blank=True)
    reason_codes = serializers.ListField(child=serializers.CharField())
    auto_pause_required = serializers.BooleanField()
    triggered_at = serializers.DateTimeField()


class SessionWarningsResponseSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    session_status = serializers.CharField()
    mode = serializers.CharField()
    warning_count = serializers.IntegerField()
    active_cycle = WarningCycleSummarySerializer(allow_null=True)
    warnings = SessionWarningEntrySerializer(many=True)


class SessionInsightResponseSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    status = serializers.CharField()
    observations = serializers.ListField(child=serializers.CharField())
    source = serializers.CharField(allow_null=True)
    model = serializers.CharField(allow_null=True)
    generated_at = serializers.DateTimeField(allow_null=True)
    retry_count = serializers.IntegerField()
    error_code = serializers.CharField(allow_null=True)


class SessionInsightRetryResponseSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    status = serializers.CharField()
    message = serializers.CharField()
    retry_count = serializers.IntegerField()

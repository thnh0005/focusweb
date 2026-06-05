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

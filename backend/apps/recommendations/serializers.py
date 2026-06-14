from rest_framework import serializers


class PeriodSerializer(serializers.Serializer):
    range = serializers.ChoiceField(choices=["30d", "90d", "all"])
    start = serializers.DateTimeField(allow_null=True)
    end = serializers.DateTimeField()


class BestTimeSerializer(serializers.Serializer):
    label = serializers.CharField()
    start_hour = serializers.IntegerField(min_value=0, max_value=23)
    end_hour = serializers.IntegerField(min_value=0, max_value=23)
    average_score = serializers.FloatField()
    session_count = serializers.IntegerField()
    completion_rate = serializers.FloatField()
    total_focus_minutes = serializers.IntegerField()


class BestDurationSerializer(serializers.Serializer):
    label = serializers.CharField()
    min_minutes = serializers.IntegerField()
    max_minutes = serializers.IntegerField(allow_null=True)
    average_score = serializers.FloatField()
    session_count = serializers.IntegerField()
    completion_rate = serializers.FloatField()
    average_actual_minutes = serializers.FloatField()


class TopDomainSerializer(serializers.Serializer):
    domain = serializers.CharField()
    warning_count = serializers.IntegerField()
    affected_session_count = serializers.IntegerField()


class DistractionTriggersSerializer(serializers.Serializer):
    top_domains = TopDomainSerializer(many=True)
    average_tab_switches = serializers.FloatField()
    average_warnings_per_session = serializers.FloatField()
    average_idle_seconds = serializers.FloatField()
    most_distracted_period = serializers.ChoiceField(
        choices=["early", "middle", "late"],
        allow_null=True,
    )


class ScoreTrendSerializer(serializers.Serializer):
    direction = serializers.ChoiceField(choices=["up", "down", "stable"])
    change = serializers.FloatField()


class PatternsSerializer(serializers.Serializer):
    best_time = BestTimeSerializer(allow_null=True)
    best_duration = BestDurationSerializer(allow_null=True)
    distraction_triggers = DistractionTriggersSerializer()
    score_trend = ScoreTrendSerializer()


class PatternDetectionResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ready", "insufficient_data"])
    minimum_sessions = serializers.IntegerField(required=False)
    current_sessions = serializers.IntegerField(required=False)
    session_count = serializers.IntegerField(required=False)
    period = PeriodSerializer(required=False)
    patterns = PatternsSerializer(allow_null=True)
    generated_at = serializers.DateTimeField(required=False)


class RecommendationItemSerializer(serializers.Serializer):
    type = serializers.CharField()
    priority = serializers.ChoiceField(choices=["high", "medium", "low"])
    confidence = serializers.ChoiceField(choices=["high", "medium", "low"])
    reason_code = serializers.CharField()
    title = serializers.CharField(required=False)
    message = serializers.CharField(required=False)
    recommended_value = serializers.JSONField(required=False, allow_null=True)
    recommended_action = serializers.CharField(required=False)
    domain = serializers.CharField(required=False)
    unit = serializers.CharField(required=False)
    reason = serializers.DictField(required=False)


class SmartPresetSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["normal", "deep_work"])
    requires_goal = serializers.BooleanField(required=False)
    duration_minutes = serializers.IntegerField()
    break_minutes = serializers.IntegerField()
    preferred_time = serializers.DictField(allow_null=True)
    confidence = serializers.ChoiceField(choices=["default", "high", "medium", "low"])
    reason_codes = serializers.ListField(child=serializers.CharField(), required=False)
    personalized = serializers.BooleanField(required=False)


class RecommendationResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ready", "insufficient_data"])
    minimum_sessions = serializers.IntegerField(required=False)
    current_sessions = serializers.IntegerField(required=False)
    session_count = serializers.IntegerField(required=False)
    period = PeriodSerializer(required=False)
    recommendations = RecommendationItemSerializer(many=True)
    smart_preset = SmartPresetSerializer(allow_null=True)
    generated_at = serializers.DateTimeField(required=False)


class SmartPresetRationaleSerializer(serializers.Serializer):
    reason_code = serializers.CharField()
    message = serializers.CharField()


class SmartPresetResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ready", "insufficient_data"])
    personalized = serializers.BooleanField()
    minimum_sessions = serializers.IntegerField(required=False)
    current_sessions = serializers.IntegerField(required=False)
    session_count = serializers.IntegerField(required=False)
    range = serializers.ChoiceField(choices=["30d", "90d", "all"])
    preset_version = serializers.CharField()
    preset = SmartPresetSerializer()
    rationale = SmartPresetRationaleSerializer(many=True)
    generated_at = serializers.DateTimeField()

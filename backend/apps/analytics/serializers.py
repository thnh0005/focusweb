from rest_framework import serializers

from .models import ReportExportJob


class DashboardStatsSerializer(serializers.Serializer):
    totalFocusMinutes = serializers.IntegerField()
    totalSessions = serializers.IntegerField()
    averageFocusScore = serializers.FloatField(allow_null=True)
    deepWorkSessionCount = serializers.IntegerField()
    completionRate = serializers.FloatField()
    dateRange = serializers.ChoiceField(choices=["today", "7d", "30d", "90d", "all"])


class DashboardOverviewSerializer(serializers.Serializer):
    totalFocusMinutes = serializers.IntegerField()
    totalSessions = serializers.IntegerField()
    completedSessions = serializers.IntegerField()
    averageFocusScore = serializers.FloatField(allow_null=True)
    completionRate = serializers.FloatField()
    deepWorkSessionCount = serializers.IntegerField()
    activeSessionId = serializers.UUIDField(allow_null=True)
    lastSessionAt = serializers.DateTimeField(allow_null=True)
    dateRange = serializers.ChoiceField(choices=["today", "7d", "30d", "90d", "all"])


class AnalyticsOverviewSerializer(serializers.Serializer):
    totalFocusMinutes = serializers.IntegerField()
    totalSessions = serializers.IntegerField()
    completedSessions = serializers.IntegerField()
    averageFocusScore = serializers.FloatField(allow_null=True)
    completionRate = serializers.FloatField()
    deepWorkSessionCount = serializers.IntegerField()
    averageSessionMinutes = serializers.FloatField()
    bestFocusState = serializers.CharField(allow_blank=True)
    dateRange = serializers.ChoiceField(choices=["today", "7d", "30d", "90d", "all"])


class FocusTrendDataPointSerializer(serializers.Serializer):
    date = serializers.DateField()
    averageScore = serializers.FloatField(allow_null=True)
    sessionCount = serializers.IntegerField()
    totalMinutes = serializers.IntegerField()


class FocusTrendSerializer(serializers.Serializer):
    dataPoints = FocusTrendDataPointSerializer(many=True)
    trendDirection = serializers.ChoiceField(choices=["up", "down", "neutral"])
    trendPercentage = serializers.FloatField()
    dateRange = serializers.ChoiceField(choices=["today", "7d", "30d", "90d", "all"])


class DistractionSourceSerializer(serializers.Serializer):
    domain = serializers.CharField()
    warningCount = serializers.IntegerField()
    sessionCount = serializers.IntegerField()
    percentageOfSessions = serializers.FloatField()
    severity = serializers.ChoiceField(choices=["high", "medium", "low"])


class DistractionAnalyticsSerializer(serializers.Serializer):
    topSources = DistractionSourceSerializer(many=True)
    totalWarnings = serializers.IntegerField()
    averageWarningsPerSession = serializers.FloatField()
    warningTrend = serializers.ChoiceField(choices=["up", "down", "neutral"])
    dateRange = serializers.ChoiceField(choices=["today", "7d", "30d", "90d", "all"])


class HeatmapDataPointSerializer(serializers.Serializer):
    hour = serializers.IntegerField(min_value=0, max_value=23)
    day = serializers.IntegerField(min_value=0, max_value=6)
    averageScore = serializers.FloatField(allow_null=True)
    sessionCount = serializers.IntegerField()


class WeekStatsSerializer(serializers.Serializer):
    weekStart = serializers.DateField()
    weekEnd = serializers.DateField()
    totalFocusMinutes = serializers.IntegerField()
    totalSessions = serializers.IntegerField()
    averageFocusScore = serializers.FloatField(allow_null=True)
    deepWorkCount = serializers.IntegerField()
    completionRate = serializers.FloatField()


class WeeklyDeltaSerializer(serializers.Serializer):
    focusMinutes = serializers.IntegerField()
    sessions = serializers.IntegerField()
    averageFocusScore = serializers.FloatField(allow_null=True)
    deepWorkCount = serializers.IntegerField()


class WeeklySnapshotSerializer(serializers.Serializer):
    thisWeek = WeekStatsSerializer()
    lastWeek = WeekStatsSerializer()
    delta = WeeklyDeltaSerializer()
    aiRecommendation = serializers.CharField(required=False)
    trendDirection = serializers.ChoiceField(choices=["up", "down", "neutral"])


class PatternInsightsSerializer(serializers.Serializer):
    patterns = serializers.ListField(child=serializers.DictField())
    minimumSessionsReached = serializers.BooleanField()
    sessionsAnalyzed = serializers.IntegerField()
    generatedAt = serializers.DateTimeField()


class SessionBreakdownSerializer(serializers.Serializer):
    normalSessionCount = serializers.IntegerField()
    deepWorkSessionCount = serializers.IntegerField()
    normalSessionPercentage = serializers.FloatField()
    deepWorkSessionPercentage = serializers.FloatField()
    averageNormalScore = serializers.FloatField(allow_null=True)
    averageDeepWorkScore = serializers.FloatField(allow_null=True)
    dateRange = serializers.ChoiceField(choices=["today", "7d", "30d", "90d", "all"])


class ReportExportRequestSerializer(serializers.Serializer):
    dateRange = serializers.ChoiceField(
        choices=["today", "7d", "30d", "90d", "all"],
        default="7d",
        required=False,
    )
    format = serializers.ChoiceField(
        choices=ReportExportJob.Format.choices,
        default=ReportExportJob.Format.JSON,
        required=False,
    )
    tag = serializers.CharField(required=False, allow_blank=True, max_length=50)


class ReportExportJobSerializer(serializers.ModelSerializer):
    jobId = serializers.UUIDField(source="id", read_only=True)
    dateRange = serializers.CharField(source="date_range", read_only=True)
    format = serializers.CharField(source="export_format", read_only=True)
    downloadUrl = serializers.CharField(source="download_url", read_only=True)
    requestedAt = serializers.DateTimeField(source="requested_at", read_only=True)
    completedAt = serializers.DateTimeField(source="completed_at", read_only=True)

    class Meta:
        model = ReportExportJob
        fields = [
            "jobId",
            "status",
            "format",
            "dateRange",
            "payload",
            "downloadUrl",
            "requestedAt",
            "completedAt",
        ]

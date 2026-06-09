from datetime import datetime, time, timedelta

from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import Coalesce, ExtractHour, ExtractWeekDay, TruncDate
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.sessions.models import FocusSession

from .serializers import (
    AnalyticsOverviewSerializer,
    DashboardOverviewSerializer,
    DashboardStatsSerializer,
    DistractionAnalyticsSerializer,
    FocusTrendSerializer,
    HeatmapDataPointSerializer,
    PatternInsightsSerializer,
    SessionBreakdownSerializer,
    WeeklySnapshotSerializer,
)


DATE_RANGE_DAYS = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
}
DATE_RANGES = {"today", "7d", "30d", "90d", "all"}


def get_range_start(date_range):
    now = timezone.now()
    if date_range == "today":
        return timezone.make_aware(
            datetime.combine(timezone.localdate(now), time.min),
            timezone.get_current_timezone(),
        )
    if date_range in DATE_RANGE_DAYS:
        return now - timedelta(days=DATE_RANGE_DAYS[date_range])
    return None


def validate_date_range(request):
    date_range = request.query_params.get("range", "7d")
    if date_range not in DATE_RANGES:
        raise ValidationError({"range": ["Unsupported date range."]})
    return date_range


def sessions_for_range(user, date_range):
    """Tạo queryset session theo user để các API dashboard dùng chung."""
    sessions = FocusSession.objects.filter(user=user)
    range_start = get_range_start(date_range)
    if range_start:
        sessions = sessions.filter(started_at__gte=range_start)
    return sessions


def aggregate_sessions(sessions):
    """Tổng hợp metric MVP một lần để dashboard và analytics luôn nhất quán."""
    stats = sessions.aggregate(
        total_focus_seconds=Coalesce(
            Sum(
                "actual_duration_seconds",
                filter=Q(status=FocusSession.Status.COMPLETED),
            ),
            0,
        ),
        total_sessions=Count("id"),
        average_focus_score=Avg(
            "focus_score",
            filter=Q(status=FocusSession.Status.COMPLETED),
        ),
        deep_work_session_count=Count(
            "id",
            filter=Q(mode=FocusSession.Mode.DEEP_WORK),
        ),
        completed_session_count=Count(
            "id",
            filter=Q(status=FocusSession.Status.COMPLETED),
        ),
    )
    total_sessions = stats["total_sessions"]
    stats["completion_rate"] = (
        stats["completed_session_count"] / total_sessions * 100 if total_sessions else 0
    )
    return stats


def most_common_focus_state(sessions):
    row = (
        sessions.filter(
            status=FocusSession.Status.COMPLETED,
            focus_state__gt="",
        )
        .values("focus_state")
        .annotate(total=Count("id"))
        .order_by("-total", "focus_state")
        .first()
    )
    return row["focus_state"] if row else ""


def trend_values(values):
    if len(values) < 2:
        return "neutral", 0
    first, last = values[0], values[-1]
    if last > first:
        direction = "up"
    elif last < first:
        direction = "down"
    else:
        return "neutral", 0
    percentage = abs((last - first) / first * 100) if first else 0
    return direction, round(percentage, 2)


def week_stats(user, week_start):
    week_end = week_start + timedelta(days=7)
    sessions = FocusSession.objects.filter(
        user=user,
        started_at__gte=week_start,
        started_at__lt=week_end,
    )
    stats = aggregate_sessions(sessions)
    return {
        "weekStart": week_start.date(),
        "weekEnd": (week_end - timedelta(days=1)).date(),
        "totalFocusMinutes": stats["total_focus_seconds"] // 60,
        "totalSessions": stats["total_sessions"],
        "averageFocusScore": stats["average_focus_score"],
        "deepWorkCount": stats["deep_work_session_count"],
        "completionRate": round(stats["completion_rate"], 2),
    }


class DashboardStatsView(GenericAPIView):
    serializer_class = DashboardStatsSerializer

    @extend_schema(
        operation_id="analytics_dashboard",
        parameters=[
            OpenApiParameter(
                name="range",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["today", "7d", "30d", "90d", "all"],
                default="7d",
            )
        ],
        responses=DashboardStatsSerializer,
    )
    def get(self, request):
        date_range = validate_date_range(request)
        stats = aggregate_sessions(sessions_for_range(request.user, date_range))
        data = {
            "totalFocusMinutes": stats["total_focus_seconds"] // 60,
            "totalSessions": stats["total_sessions"],
            "averageFocusScore": stats["average_focus_score"],
            "deepWorkSessionCount": stats["deep_work_session_count"],
            "completionRate": round(stats["completion_rate"], 2),
            "dateRange": date_range,
        }
        return Response(DashboardStatsSerializer(data).data)


class AnalyticsOverviewView(GenericAPIView):
    serializer_class = AnalyticsOverviewSerializer

    @extend_schema(
        operation_id="analytics_overview",
        parameters=[
            OpenApiParameter(
                name="range",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["today", "7d", "30d", "90d", "all"],
                default="7d",
            )
        ],
        responses=AnalyticsOverviewSerializer,
    )
    def get(self, request):
        # Overview tuần 3 mở rộng dashboard MVP bằng average duration
        # và focus state phổ biến nhất trong khoảng thời gian chọn.
        date_range = validate_date_range(request)
        sessions = sessions_for_range(request.user, date_range)
        stats = aggregate_sessions(sessions)
        completed_count = stats["completed_session_count"]
        average_session_minutes = (
            stats["total_focus_seconds"] / completed_count / 60
            if completed_count
            else 0
        )
        data = {
            "totalFocusMinutes": stats["total_focus_seconds"] // 60,
            "totalSessions": stats["total_sessions"],
            "completedSessions": completed_count,
            "averageFocusScore": stats["average_focus_score"],
            "completionRate": round(stats["completion_rate"], 2),
            "deepWorkSessionCount": stats["deep_work_session_count"],
            "averageSessionMinutes": round(average_session_minutes, 2),
            "bestFocusState": most_common_focus_state(sessions),
            "dateRange": date_range,
        }
        return Response(AnalyticsOverviewSerializer(data).data)


class DashboardOverviewView(GenericAPIView):
    serializer_class = DashboardOverviewSerializer

    @extend_schema(
        operation_id="dashboard_overview",
        parameters=[
            OpenApiParameter(
                name="range",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["today", "7d", "30d", "90d", "all"],
                default="7d",
            )
        ],
        responses=DashboardOverviewSerializer,
    )
    def get(self, request):
        # Dashboard overview tuần 2 trả payload gọn cho các card MVP:
        # tổng thời gian, completion rate, active session và hoạt động gần nhất.
        date_range = validate_date_range(request)
        sessions = sessions_for_range(request.user, date_range)
        stats = aggregate_sessions(sessions)
        active_session = (
            FocusSession.objects.filter(
                user=request.user,
                status__in=FocusSession.OPEN_STATUSES,
            )
            .order_by("-started_at")
            .first()
        )
        last_session = (
            FocusSession.objects.filter(user=request.user)
            .order_by("-started_at")
            .first()
        )
        data = {
            "totalFocusMinutes": stats["total_focus_seconds"] // 60,
            "totalSessions": stats["total_sessions"],
            "completedSessions": stats["completed_session_count"],
            "averageFocusScore": stats["average_focus_score"],
            "completionRate": round(stats["completion_rate"], 2),
            "deepWorkSessionCount": stats["deep_work_session_count"],
            "activeSessionId": active_session.pk if active_session else None,
            "lastSessionAt": last_session.started_at if last_session else None,
            "dateRange": date_range,
        }
        return Response(DashboardOverviewSerializer(data).data)


class FocusTrendView(GenericAPIView):
    serializer_class = FocusTrendSerializer

    @extend_schema(operation_id="analytics_focus_trend", responses=FocusTrendSerializer)
    def get(self, request):
        date_range = validate_date_range(request)
        rows = (
            sessions_for_range(request.user, date_range)
            .filter(status=FocusSession.Status.COMPLETED)
            .annotate(day=TruncDate("started_at"))
            .values("day")
            .annotate(
                average_score=Avg("focus_score"),
                session_count=Count("id"),
                total_seconds=Sum("actual_duration_seconds"),
            )
            .order_by("day")
        )
        data_points = [
            {
                "date": row["day"],
                "averageScore": row["average_score"],
                "sessionCount": row["session_count"],
                "totalMinutes": row["total_seconds"] // 60,
            }
            for row in rows
        ]
        scores = [
            point["averageScore"]
            for point in data_points
            if point["averageScore"] is not None
        ]
        direction, percentage = trend_values(scores)
        data = {
            "dataPoints": data_points,
            "trendDirection": direction,
            "trendPercentage": percentage,
            "dateRange": date_range,
        }
        return Response(FocusTrendSerializer(data).data)


class FocusTrendContractView(FocusTrendView):
    @extend_schema(operation_id="analytics_focus_trend_contract", responses=FocusTrendSerializer)
    def get(self, request):
        return super().get(request)


class DistractionAnalyticsView(GenericAPIView):
    serializer_class = DistractionAnalyticsSerializer

    @extend_schema(
        operation_id="analytics_distractions",
        responses=DistractionAnalyticsSerializer,
    )
    def get(self, request):
        date_range = validate_date_range(request)
        data = {
            "topSources": [],
            "totalWarnings": 0,
            "averageWarningsPerSession": 0,
            "warningTrend": "neutral",
            "dateRange": date_range,
        }
        return Response(DistractionAnalyticsSerializer(data).data)


class SessionBreakdownView(GenericAPIView):
    serializer_class = SessionBreakdownSerializer

    @extend_schema(
        operation_id="analytics_session_breakdown",
        parameters=[
            OpenApiParameter(
                name="range",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["today", "7d", "30d", "90d", "all"],
                default="7d",
            )
        ],
        responses=SessionBreakdownSerializer,
    )
    def get(self, request):
        date_range = validate_date_range(request)
        sessions = sessions_for_range(request.user, date_range)
        stats = sessions.aggregate(
            normal_count=Count("id", filter=Q(mode=FocusSession.Mode.NORMAL)),
            deep_count=Count("id", filter=Q(mode=FocusSession.Mode.DEEP_WORK)),
            average_normal_score=Avg(
                "focus_score",
                filter=Q(
                    mode=FocusSession.Mode.NORMAL,
                    status=FocusSession.Status.COMPLETED,
                ),
            ),
            average_deep_work_score=Avg(
                "focus_score",
                filter=Q(
                    mode=FocusSession.Mode.DEEP_WORK,
                    status=FocusSession.Status.COMPLETED,
                ),
            ),
        )
        total = stats["normal_count"] + stats["deep_count"]
        data = {
            "normalSessionCount": stats["normal_count"],
            "deepWorkSessionCount": stats["deep_count"],
            "normalSessionPercentage": round(stats["normal_count"] / total * 100, 2)
            if total
            else 0,
            "deepWorkSessionPercentage": round(stats["deep_count"] / total * 100, 2)
            if total
            else 0,
            "averageNormalScore": stats["average_normal_score"],
            "averageDeepWorkScore": stats["average_deep_work_score"],
            "dateRange": date_range,
        }
        return Response(SessionBreakdownSerializer(data).data)


class HeatmapView(GenericAPIView):
    serializer_class = HeatmapDataPointSerializer

    @extend_schema(
        operation_id="analytics_heatmap",
        responses=HeatmapDataPointSerializer(many=True),
    )
    def get(self, request):
        rows = (
            FocusSession.objects.filter(
                user=request.user,
                status=FocusSession.Status.COMPLETED,
            )
            .annotate(hour=ExtractHour("started_at"), weekday=ExtractWeekDay("started_at"))
            .values("hour", "weekday")
            .annotate(average_score=Avg("focus_score"), session_count=Count("id"))
            .order_by("weekday", "hour")
        )
        data = [
            {
                "hour": row["hour"],
                "day": row["weekday"] - 1,
                "averageScore": row["average_score"],
                "sessionCount": row["session_count"],
            }
            for row in rows
        ]
        return Response(HeatmapDataPointSerializer(data, many=True).data)


class TimeHeatmapView(HeatmapView):
    @extend_schema(
        operation_id="analytics_time_heatmap",
        responses=HeatmapDataPointSerializer(many=True),
    )
    def get(self, request):
        return super().get(request)


class WeeklySnapshotView(GenericAPIView):
    serializer_class = WeeklySnapshotSerializer

    @extend_schema(
        operation_id="analytics_weekly_snapshot",
        responses=WeeklySnapshotSerializer,
    )
    def get(self, request):
        today = timezone.localdate()
        monday = today - timedelta(days=today.weekday())
        current_start = timezone.make_aware(
            datetime.combine(monday, time.min),
            timezone.get_current_timezone(),
        )
        this_week = week_stats(request.user, current_start)
        last_week = week_stats(request.user, current_start - timedelta(days=7))
        score_delta = None
        if (
            this_week["averageFocusScore"] is not None
            and last_week["averageFocusScore"] is not None
        ):
            score_delta = round(
                this_week["averageFocusScore"] - last_week["averageFocusScore"],
                2,
            )
        direction, _ = trend_values(
            [last_week["totalFocusMinutes"], this_week["totalFocusMinutes"]]
        )
        data = {
            "thisWeek": this_week,
            "lastWeek": last_week,
            "delta": {
                "focusMinutes": (
                    this_week["totalFocusMinutes"] - last_week["totalFocusMinutes"]
                ),
                "sessions": this_week["totalSessions"] - last_week["totalSessions"],
                "averageFocusScore": score_delta,
                "deepWorkCount": (
                    this_week["deepWorkCount"] - last_week["deepWorkCount"]
                ),
            },
            "trendDirection": direction,
        }
        return Response(WeeklySnapshotSerializer(data).data)


class PatternInsightsView(GenericAPIView):
    serializer_class = PatternInsightsSerializer

    @extend_schema(
        operation_id="analytics_patterns",
        responses=PatternInsightsSerializer,
    )
    def get(self, request):
        count = FocusSession.objects.filter(
            user=request.user,
            status=FocusSession.Status.COMPLETED,
        ).count()
        data = {
            "patterns": [],
            "minimumSessionsReached": count >= 5,
            "sessionsAnalyzed": count,
            "generatedAt": timezone.now(),
        }
        return Response(PatternInsightsSerializer(data).data)

from datetime import datetime, time, timedelta

from django.db.models import Avg, Count, Max, Q, Sum
from django.db.models.functions import Coalesce, ExtractHour, ExtractWeekDay, TruncDate
from django.db import transaction
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from apps.sessions.models import FocusSession
from apps.tracking.models import WarningEvent
from apps.recommendations.weekly_report_service import WeeklyFocusReportService

from .models import ReportExportJob
from .report_export import (
    ReportValidationError,
    create_or_reuse_pdf_export_job,
    date_range_from_preset,
    resolve_user_timezone,
    validate_report_dates,
)
from .serializers import (
    AnalyticsOverviewSerializer,
    DashboardOverviewSerializer,
    DashboardStatsSerializer,
    DistractionAnalyticsSerializer,
    FocusTrendSerializer,
    HeatmapDataPointSerializer,
    PatternInsightsSerializer,
    ReportExportJobSerializer,
    ReportExportRequestSerializer,
    SessionBreakdownSerializer,
    WeeklySnapshotSerializer,
)
from .tasks import generate_study_report_export_task


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


def sessions_for_range(user, date_range, tag=None):
    """Tạo queryset session theo user để các API dashboard dùng chung."""
    sessions = FocusSession.objects.filter(user=user)
    range_start = get_range_start(date_range)
    if range_start:
        sessions = sessions.filter(started_at__gte=range_start)
    if tag:
        sessions = sessions.filter(tags__name=tag)
    return sessions.distinct()


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


def build_report_payload(user, date_range, tag=""):
    sessions = sessions_for_range(user, date_range, tag).prefetch_related("tags")
    stats = aggregate_sessions(sessions)
    return {
        "summary": {
            "totalFocusMinutes": stats["total_focus_seconds"] // 60,
            "totalSessions": stats["total_sessions"],
            "completedSessions": stats["completed_session_count"],
            "averageFocusScore": stats["average_focus_score"],
            "completionRate": round(stats["completion_rate"], 2),
            "deepWorkSessionCount": stats["deep_work_session_count"],
            "dateRange": date_range,
            "tag": tag,
        },
        "sessions": [
            {
                "id": str(session.id),
                "mode": session.mode,
                "goal": session.goal,
                "status": session.status,
                "focusScore": session.focus_score,
                "focusState": session.focus_state,
                "actualDurationSeconds": session.actual_duration_seconds,
                "startedAt": session.started_at.isoformat(),
                "endedAt": session.ended_at.isoformat() if session.ended_at else None,
                "tags": [tag.name for tag in session.tags.all()],
            }
            for session in sessions.order_by("-started_at")[:200]
        ],
    }


def get_owned_export_job(user, job_id):
    try:
        return ReportExportJob.objects.get(pk=job_id, user=user)
    except (ReportExportJob.DoesNotExist, ValueError) as exc:
        raise NotFound("Report export job was not found.") from exc


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
        stats = aggregate_sessions(
            sessions_for_range(request.user, date_range, request.query_params.get("tag"))
        )
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
        sessions = sessions_for_range(request.user, date_range, request.query_params.get("tag"))
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
        sessions = sessions_for_range(request.user, date_range, request.query_params.get("tag"))
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
            sessions_for_range(request.user, date_range, request.query_params.get("tag"))
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
        sessions = sessions_for_range(request.user, date_range, request.query_params.get("tag"))
        session_ids = list(sessions.values_list("id", flat=True))
        warnings = WarningEvent.objects.filter(session_id__in=session_ids)
        total_sessions = len(session_ids)
        total_warnings = warnings.count()
        rows = (
            warnings.exclude(domain="")
            .values("domain")
            .annotate(
                warning_count=Count("id"),
                session_count=Count("session_id", distinct=True),
                max_level=Max("warning_level"),
            )
            .order_by("-warning_count", "domain")[:5]
        )
        top_sources = [
            {
                "domain": row["domain"],
                "warningCount": row["warning_count"],
                "sessionCount": row["session_count"],
                "percentageOfSessions": round(
                    row["session_count"] / total_sessions * 100,
                    2,
                )
                if total_sessions
                else 0,
                "severity": self.severity(row["max_level"], row["warning_count"]),
            }
            for row in rows
        ]
        daily_counts = [
            item["count"]
            for item in (
                warnings.annotate(day=TruncDate("created_at"))
                .values("day")
                .annotate(count=Count("id"))
                .order_by("day")
            )
        ]
        trend, _percentage = trend_values(daily_counts)
        data = {
            "topSources": top_sources,
            "totalWarnings": total_warnings,
            "averageWarningsPerSession": round(total_warnings / total_sessions, 2)
            if total_sessions
            else 0,
            "warningTrend": trend,
            "dateRange": date_range,
        }
        return Response(DistractionAnalyticsSerializer(data).data)

    @staticmethod
    def severity(max_level, warning_count):
        if max_level == 3 or warning_count >= 5:
            return "high"
        if max_level == 2 or warning_count >= 2:
            return "medium"
        return "low"


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
        sessions = sessions_for_range(request.user, date_range, request.query_params.get("tag"))
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
        sessions = FocusSession.objects.filter(
            user=request.user,
            status=FocusSession.Status.COMPLETED,
        )
        tag = request.query_params.get("tag")
        if tag:
            sessions = sessions.filter(tags__name=tag)
        rows = (
            sessions.distinct()
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
        data = WeeklyFocusReportService(request.user).build()
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


class ReportExportView(GenericAPIView):
    serializer_class = ReportExportJobSerializer

    @extend_schema(
        operation_id="report_export_create",
        request=ReportExportRequestSerializer,
        responses=ReportExportJobSerializer,
    )
    def post(self, request):
        serializer = ReportExportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        date_range = serializer.validated_data.get("dateRange", "7d")
        export_format = serializer.validated_data["format"]
        if export_format == ReportExportJob.Format.PDF:
            try:
                tzinfo, _timezone_name = resolve_user_timezone(request.user)
                has_date_from = bool(serializer.validated_data.get("date_from"))
                has_date_to = bool(serializer.validated_data.get("date_to"))
                if has_date_from != has_date_to:
                    raise ReportValidationError(
                        "date_from and date_to must be provided together.",
                        code="INVALID_REPORT_DATE_RANGE",
                    )
                if has_date_from and has_date_to:
                    date_from = serializer.validated_data["date_from"]
                    date_to = serializer.validated_data["date_to"]
                else:
                    range_name = serializer.validated_data.get("range") or date_range
                    date_from, date_to = date_range_from_preset(range_name, tzinfo)
                validate_report_dates(date_from, date_to)
            except ReportValidationError as exc:
                raise ValidationError({"error_code": exc.code, "detail": str(exc)}) from exc

            job, created = create_or_reuse_pdf_export_job(
                request.user,
                date_from,
                date_to,
            )
            if created:
                transaction.on_commit(
                    lambda: generate_study_report_export_task.delay(str(job.id))
                )
            return Response(
                ReportExportJobSerializer(job).data,
                status=status.HTTP_202_ACCEPTED if created else status.HTTP_200_OK,
            )

        tag = serializer.validated_data.get("tag", "")
        payload = build_report_payload(request.user, date_range, tag)
        if export_format == ReportExportJob.Format.HTML:
            payload["html"] = (
                "<h1>FocusOS Study Report</h1>"
                f"<p>Total focus minutes: {payload['summary']['totalFocusMinutes']}</p>"
            )
        if export_format == ReportExportJob.Format.PDF:
            payload["note"] = "PDF rendering is reserved for the export worker; JSON data is ready."
        job = ReportExportJob.objects.create(
            user=request.user,
            status=ReportExportJob.Status.READY,
            export_format=export_format,
            date_range=date_range,
            payload=payload,
            completed_at=timezone.now(),
        )
        return Response(
            ReportExportJobSerializer(job).data,
            status=status.HTTP_201_CREATED,
        )


class ReportExportDetailView(GenericAPIView):
    serializer_class = ReportExportJobSerializer

    @extend_schema(operation_id="report_export_retrieve", responses=ReportExportJobSerializer)
    def get(self, request, job_id):
        job = get_owned_export_job(request.user, job_id)
        if (
            job.status == ReportExportJob.Status.COMPLETED
            and job.expires_at
            and job.expires_at <= timezone.now()
        ):
            job.status = ReportExportJob.Status.EXPIRED
            job.download_url = ""
            if job.file:
                job.file.delete(save=False)
                job.file = ""
            job.save(update_fields=["status", "download_url", "file", "updated_at"])
        return Response(ReportExportJobSerializer(job).data)

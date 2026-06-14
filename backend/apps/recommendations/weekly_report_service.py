from datetime import datetime, time, timedelta

from django.db.models import Avg, Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.sessions.models import FocusSession
from apps.tracking.models import BrowserEvent, WarningEvent

from .services import FocusRecommendationService, PatternDetectionService, rounded


class WeeklyFocusReportService:
    PATTERN_RANGE = "30d"

    def __init__(self, user, reference_date=None, force_refresh=False):
        self.user = user
        self.reference_date = reference_date or timezone.localdate()
        self.force_refresh = force_refresh

    def build(self):
        current_start, current_end = self.week_bounds(self.reference_date)
        previous_start = current_start - timedelta(days=7)
        previous_end = current_start

        current_week = self.week_metrics(current_start, current_end)
        previous_week = self.week_metrics(previous_start, previous_end)
        comparison = (
            None
            if current_week["total_sessions"] == 0
            else self.compare_weeks(current_week, previous_week)
        )
        focus_trend = self.focus_trend(current_week, previous_week)
        patterns = self.patterns_section(current_end)
        recommendations = self.recommendations_section(current_end, patterns["_raw"])
        commentary = (
            []
            if current_week["total_sessions"] == 0
            else self.commentary(current_week, previous_week, comparison, focus_trend)
        )
        status = "ready" if current_week["total_sessions"] else "no_current_week_data"
        personalized = status == "ready" and bool(recommendations)

        report = {
            "status": status,
            "data_complete": status == "ready",
            "personalized": personalized,
            "period": {
                "current_week_start": current_start.date(),
                "current_week_end": (current_end - timedelta(days=1)).date(),
                "previous_week_start": previous_start.date(),
                "previous_week_end": (previous_end - timedelta(days=1)).date(),
            },
            "current_week": current_week,
            "previous_week": previous_week,
            "comparison": comparison,
            "focus_trend": focus_trend,
            "patterns": {key: value for key, value in patterns.items() if key != "_raw"},
            "recommendations": recommendations,
            "commentary": commentary,
            "generated_at": timezone.now(),
        }
        report.update(self.legacy_weekly_snapshot(report))
        return report

    def week_bounds(self, reference_date):
        if isinstance(reference_date, datetime):
            local_day = timezone.localtime(reference_date).date()
        else:
            local_day = reference_date
        monday = local_day - timedelta(days=local_day.weekday())
        current_start = timezone.make_aware(
            datetime.combine(monday, time.min),
            timezone.get_current_timezone(),
        )
        return current_start, current_start + timedelta(days=7)

    def week_sessions(self, start, end):
        return FocusSession.objects.filter(
            user=self.user,
            started_at__gte=start,
            started_at__lt=end,
        ).exclude(status=FocusSession.Status.CANCELLED)

    def week_metrics(self, start, end):
        sessions = self.week_sessions(start, end)
        stats = sessions.aggregate(
            total_sessions=Count("id"),
            completed_sessions=Count(
                "id",
                filter=self.completed_filter(),
            ),
            deep_work_sessions=Count(
                "id",
                filter=self.mode_filter(FocusSession.Mode.DEEP_WORK),
            ),
            normal_sessions=Count(
                "id",
                filter=self.mode_filter(FocusSession.Mode.NORMAL),
            ),
            total_focus_seconds=Sum(
                "actual_duration_seconds",
                filter=self.completed_filter(),
            ),
            average_focus_score=Avg(
                "focus_score",
                filter=self.completed_scored_filter(),
            ),
        )
        session_ids = list(sessions.values_list("id", flat=True))
        warning_stats = self.warning_stats(session_ids)
        browser_stats = self.browser_stats(session_ids)
        total_sessions = stats["total_sessions"] or 0
        completed_sessions = stats["completed_sessions"] or 0
        total_focus_seconds = stats["total_focus_seconds"] or 0

        return {
            "start": start.date(),
            "end": (end - timedelta(days=1)).date(),
            "total_focus_minutes": total_focus_seconds // 60,
            "total_focus_hours": rounded(total_focus_seconds / 3600),
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "deep_work_sessions": stats["deep_work_sessions"] or 0,
            "normal_sessions": stats["normal_sessions"] or 0,
            "average_focus_score": rounded(stats["average_focus_score"], 1)
            if stats["average_focus_score"] is not None
            else None,
            "completion_rate": rounded(completed_sessions / total_sessions * 100)
            if total_sessions
            else 0,
            "total_warnings": warning_stats["total_warnings"],
            "average_warnings_per_session": rounded(
                warning_stats["total_warnings"] / total_sessions
            )
            if total_sessions
            else 0,
            "total_tab_switches": browser_stats["total_tab_switches"],
            "unique_focus_days": self.unique_focus_days(sessions),
            "most_common_distraction_domain": warning_stats[
                "most_common_distraction_domain"
            ],
        }

    def completed_filter(self):
        return self.q(status=FocusSession.Status.COMPLETED)

    def completed_scored_filter(self):
        return self.q(status=FocusSession.Status.COMPLETED, focus_score__isnull=False)

    def mode_filter(self, mode):
        return self.q(mode=mode)

    def q(self, **kwargs):
        from django.db.models import Q

        return Q(**kwargs)

    def warning_stats(self, session_ids):
        warnings = WarningEvent.objects.filter(session_id__in=session_ids)
        total_warnings = warnings.count()
        domain_row = (
            warnings.exclude(domain="")
            .values("domain")
            .annotate(total=Count("id"))
            .order_by("-total", "domain")
            .first()
        )
        return {
            "total_warnings": total_warnings,
            "most_common_distraction_domain": domain_row["domain"] if domain_row else None,
        }

    def browser_stats(self, session_ids):
        stats = BrowserEvent.objects.filter(session_id__in=session_ids).aggregate(
            total_tab_switches=Sum("tab_switch_count"),
        )
        return {"total_tab_switches": stats["total_tab_switches"] or 0}

    def unique_focus_days(self, sessions):
        return (
            sessions.filter(status=FocusSession.Status.COMPLETED)
            .annotate(day=TruncDate("started_at"))
            .values("day")
            .distinct()
            .count()
        )

    def compare_weeks(self, current_week, previous_week):
        return {
            "focus_minutes_delta": (
                current_week["total_focus_minutes"]
                - previous_week["total_focus_minutes"]
            ),
            "focus_hours_delta": rounded(
                current_week["total_focus_hours"] - previous_week["total_focus_hours"]
            ),
            "focus_time_percent_change": self.percent_change(
                current_week["total_focus_minutes"],
                previous_week["total_focus_minutes"],
            ),
            "average_score_delta": self.nullable_delta(
                current_week["average_focus_score"],
                previous_week["average_focus_score"],
            ),
            "average_score_percent_change": self.percent_change(
                current_week["average_focus_score"],
                previous_week["average_focus_score"],
            ),
            "session_count_delta": (
                current_week["total_sessions"] - previous_week["total_sessions"]
            ),
            "deep_work_session_delta": (
                current_week["deep_work_sessions"]
                - previous_week["deep_work_sessions"]
            ),
            "completion_rate_delta": rounded(
                current_week["completion_rate"] - previous_week["completion_rate"]
            ),
            "warning_count_delta": (
                current_week["total_warnings"] - previous_week["total_warnings"]
            ),
        }

    def nullable_delta(self, current_value, previous_value):
        if current_value is None or previous_value is None:
            return None
        return rounded(current_value - previous_value, 1)

    def percent_change(self, current_value, previous_value):
        if current_value is None or previous_value in (None, 0):
            return None
        return rounded((current_value - previous_value) / previous_value * 100)

    def focus_trend(self, current_week, previous_week):
        delta = self.nullable_delta(
            current_week["average_focus_score"],
            previous_week["average_focus_score"],
        )
        if delta is None:
            return {
                "direction": "insufficient_data",
                "score_change": None,
                "label": "insufficient baseline",
            }
        if delta >= 3:
            return {"direction": "up", "score_change": delta, "label": "improving"}
        if delta <= -3:
            return {"direction": "down", "score_change": delta, "label": "declining"}
        return {"direction": "stable", "score_change": delta, "label": "stable"}

    def patterns_section(self, now):
        pattern_service = PatternDetectionService(
            self.user,
            date_range=self.PATTERN_RANGE,
            now=now,
        )
        pattern_data = pattern_service.build()
        if pattern_data["status"] != "ready":
            return {
                "status": "insufficient_data",
                "best_time": None,
                "best_duration": None,
                "distraction_triggers": None,
                "_raw": pattern_data,
            }
        patterns = pattern_data["patterns"]
        return {
            "status": "ready",
            "best_time": patterns["best_time"],
            "best_duration": patterns["best_duration"],
            "distraction_triggers": patterns["distraction_triggers"],
            "_raw": pattern_data,
        }

    def recommendations_section(self, now, pattern_data):
        recommendation_data = FocusRecommendationService(
            self.user,
            date_range=self.PATTERN_RANGE,
            limit=3,
            now=now,
            pattern_data=pattern_data,
        ).build()
        return recommendation_data.get("recommendations", [])

    def commentary(self, current_week, previous_week, comparison, focus_trend):
        if previous_week["total_sessions"] == 0:
            return [
                {
                    "type": "info",
                    "reason_code": "no_previous_week_baseline",
                    "message": "There is no previous-week baseline yet.",
                }
            ]

        items = []
        if comparison["focus_minutes_delta"] > 0:
            items.append(
                {
                    "type": "positive",
                    "reason_code": "focus_time_increased",
                    "message": (
                        "Total focus time increased by "
                        f"{comparison['focus_minutes_delta']} minutes."
                    ),
                }
            )
        elif comparison["focus_minutes_delta"] < 0:
            items.append(
                {
                    "type": "attention",
                    "reason_code": "focus_time_decreased",
                    "message": "Total focus time decreased compared with last week.",
                }
            )

        if focus_trend["direction"] == "up":
            items.append(
                {
                    "type": "positive",
                    "reason_code": "focus_score_improved",
                    "message": (
                        "Average Focus Score improved by "
                        f"{focus_trend['score_change']} points."
                    ),
                }
            )
        elif focus_trend["direction"] == "down":
            items.append(
                {
                    "type": "attention",
                    "reason_code": "focus_score_declined",
                    "message": "Average Focus Score declined compared with last week.",
                }
            )

        if comparison["warning_count_delta"] < 0:
            items.append(
                {
                    "type": "positive",
                    "reason_code": "warnings_reduced",
                    "message": "Warnings decreased compared with last week.",
                }
            )
        elif comparison["warning_count_delta"] > 0:
            items.append(
                {
                    "type": "attention",
                    "reason_code": "warnings_increased",
                    "message": "Warnings increased compared with last week.",
                }
            )

        if not items:
            items.append(
                {
                    "type": "info",
                    "reason_code": "insufficient_weekly_data",
                    "message": "Weekly metrics are available with limited change.",
                }
            )
        return items[:4]

    def legacy_weekly_snapshot(self, report):
        current = report["current_week"]
        previous = report["previous_week"]
        comparison = report["comparison"] or self.compare_weeks(current, previous)
        return {
            "thisWeek": self.legacy_week_stats(current),
            "lastWeek": self.legacy_week_stats(previous),
            "delta": {
                "focusMinutes": comparison["focus_minutes_delta"],
                "sessions": comparison["session_count_delta"],
                "averageFocusScore": comparison["average_score_delta"],
                "deepWorkCount": comparison["deep_work_session_delta"],
            },
            "trendDirection": self.legacy_trend_direction(report["focus_trend"]),
        }

    def legacy_week_stats(self, week):
        return {
            "weekStart": week["start"],
            "weekEnd": week["end"],
            "totalFocusMinutes": week["total_focus_minutes"],
            "totalSessions": week["total_sessions"],
            "averageFocusScore": week["average_focus_score"],
            "deepWorkCount": week["deep_work_sessions"],
            "completionRate": week["completion_rate"],
        }

    def legacy_trend_direction(self, focus_trend):
        if focus_trend["direction"] in {"up", "down"}:
            return focus_trend["direction"]
        return "neutral"

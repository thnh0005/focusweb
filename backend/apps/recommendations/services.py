from datetime import timedelta

from django.db.models import Avg, Case, Count, IntegerField, Sum, Value, When
from django.db.models.functions import ExtractHour
from django.utils import timezone

from apps.sessions.models import FocusSession
from apps.tracking.models import BrowserEvent, WarningEvent
from apps.extension.models import BlacklistEntry, normalize_domain


MINIMUM_SESSIONS = 5
VALID_RANGES = {"30d", "90d", "all"}

TIME_BUCKETS = {
    0: {"label": "00:00-05:59", "start_hour": 0, "end_hour": 5},
    1: {"label": "06:00-11:59", "start_hour": 6, "end_hour": 11},
    2: {"label": "12:00-17:59", "start_hour": 12, "end_hour": 17},
    3: {"label": "18:00-23:59", "start_hour": 18, "end_hour": 23},
}

DURATION_BUCKETS = {
    0: {"label": "0-29", "min_minutes": 0, "max_minutes": 29},
    1: {"label": "30-49", "min_minutes": 30, "max_minutes": 49},
    2: {"label": "50-69", "min_minutes": 50, "max_minutes": 69},
    3: {"label": "70-89", "min_minutes": 70, "max_minutes": 89},
    4: {"label": "90+", "min_minutes": 90, "max_minutes": None},
}


def rounded(value, digits=2):
    if value is None:
        return 0
    rounded_value = round(float(value), digits)
    if rounded_value == 0:
        return 0
    return rounded_value


def range_start(date_range, now):
    if date_range == "30d":
        return now - timedelta(days=30)
    if date_range == "90d":
        return now - timedelta(days=90)
    return None


def apply_range(queryset, start, end):
    queryset = queryset.filter(started_at__lte=end)
    if start:
        queryset = queryset.filter(started_at__gte=start)
    return queryset


def with_time_bucket(queryset):
    return queryset.annotate(start_hour=ExtractHour("started_at")).annotate(
        pattern_bucket=Case(
            When(start_hour__lt=6, then=Value(0)),
            When(start_hour__lt=12, then=Value(1)),
            When(start_hour__lt=18, then=Value(2)),
            default=Value(3),
            output_field=IntegerField(),
        )
    )


def with_duration_bucket(queryset):
    return queryset.annotate(
        pattern_bucket=Case(
            When(actual_duration_seconds__lt=30 * 60, then=Value(0)),
            When(actual_duration_seconds__lt=50 * 60, then=Value(1)),
            When(actual_duration_seconds__lt=70 * 60, then=Value(2)),
            When(actual_duration_seconds__lt=90 * 60, then=Value(3)),
            default=Value(4),
            output_field=IntegerField(),
        )
    )


def completion_rates(base_sessions, bucketed_queryset):
    rows = (
        bucketed_queryset(base_sessions)
        .values("pattern_bucket")
        .annotate(total=Count("id"))
    )
    return {row["pattern_bucket"]: row["total"] for row in rows}


def reliability_score(session_count):
    return min(session_count / 3, 1) * 100


def effectiveness_score(row):
    return (
        rounded(row["average_score"]) * 0.55
        + rounded(row["completion_rate"]) * 0.25
        + reliability_score(row["session_count"]) * 0.20
    )


def choose_best(rows):
    if not rows:
        return None
    return sorted(
        rows,
        key=lambda row: (
            -effectiveness_score(row),
            -row["session_count"],
            -rounded(row["average_score"]),
            row.get("start_hour", row.get("min_minutes", 0)),
        ),
    )[0]


class PatternDetectionService:
    def __init__(self, user, date_range="30d", now=None):
        self.user = user
        self.date_range = date_range
        self.now = now or timezone.now()
        self.start = range_start(date_range, self.now)

    def build(self):
        base_sessions = self.base_sessions()
        valid_sessions = self.valid_sessions(base_sessions)
        session_count = valid_sessions.count()

        if session_count < MINIMUM_SESSIONS:
            return {
                "status": "insufficient_data",
                "minimum_sessions": MINIMUM_SESSIONS,
                "current_sessions": session_count,
                "patterns": None,
            }

        return {
            "status": "ready",
            "session_count": session_count,
            "period": {
                "range": self.date_range,
                "start": self.start,
                "end": self.now,
            },
            "patterns": {
                "best_time": self.best_time(base_sessions, valid_sessions),
                "best_duration": self.best_duration(base_sessions, valid_sessions),
                "distraction_triggers": self.distraction_triggers(valid_sessions),
                "score_trend": self.score_trend(valid_sessions),
            },
            "generated_at": self.now,
        }

    def base_sessions(self):
        sessions = FocusSession.objects.filter(user=self.user).exclude(
            status=FocusSession.Status.CANCELLED
        )
        return apply_range(sessions, self.start, self.now)

    def valid_sessions(self, base_sessions):
        return base_sessions.filter(
            status=FocusSession.Status.COMPLETED,
            focus_score__isnull=False,
        )

    def best_time(self, base_sessions, valid_sessions):
        denominators = completion_rates(base_sessions, with_time_bucket)
        rows = []
        aggregates = (
            with_time_bucket(valid_sessions)
            .values("pattern_bucket")
            .annotate(
                average_score=Avg("focus_score"),
                session_count=Count("id"),
                total_focus_seconds=Sum("actual_duration_seconds"),
            )
            .order_by("pattern_bucket")
        )
        for row in aggregates:
            bucket = TIME_BUCKETS[row["pattern_bucket"]]
            denominator = max(denominators.get(row["pattern_bucket"], 0), 1)
            rows.append(
                {
                    **bucket,
                    "average_score": rounded(row["average_score"], 1),
                    "session_count": row["session_count"],
                    "completion_rate": rounded(row["session_count"] / denominator * 100),
                    "total_focus_minutes": (row["total_focus_seconds"] or 0) // 60,
                }
            )
        return choose_best(rows)

    def best_duration(self, base_sessions, valid_sessions):
        denominators = completion_rates(base_sessions, with_duration_bucket)
        rows = []
        aggregates = (
            with_duration_bucket(valid_sessions)
            .values("pattern_bucket")
            .annotate(
                average_score=Avg("focus_score"),
                session_count=Count("id"),
                average_actual_seconds=Avg("actual_duration_seconds"),
            )
            .order_by("pattern_bucket")
        )
        for row in aggregates:
            bucket = DURATION_BUCKETS[row["pattern_bucket"]]
            denominator = max(denominators.get(row["pattern_bucket"], 0), 1)
            rows.append(
                {
                    **bucket,
                    "average_score": rounded(row["average_score"], 1),
                    "session_count": row["session_count"],
                    "completion_rate": rounded(row["session_count"] / denominator * 100),
                    "average_actual_minutes": rounded(
                        (row["average_actual_seconds"] or 0) / 60,
                        1,
                    ),
                }
            )
        return choose_best(rows)

    def distraction_triggers(self, valid_sessions):
        session_map = {session.id: session for session in valid_sessions}
        session_ids = list(session_map)
        if not session_ids:
            return self.empty_distractions()

        warnings = WarningEvent.objects.filter(session_id__in=session_ids)
        browser_events = BrowserEvent.objects.filter(session_id__in=session_ids)
        warning_count = warnings.count()

        top_domains = self.top_warning_domains(warnings)
        averages = self.browser_event_averages(browser_events, len(session_ids))
        most_distracted_period = self.most_distracted_period(warnings, session_map)

        return {
            "top_domains": top_domains,
            "average_tab_switches": averages["average_tab_switches"],
            "average_warnings_per_session": rounded(warning_count / len(session_ids)),
            "average_idle_seconds": averages["average_idle_seconds"],
            "most_distracted_period": most_distracted_period,
        }

    def empty_distractions(self):
        return {
            "top_domains": [],
            "average_tab_switches": 0,
            "average_warnings_per_session": 0,
            "average_idle_seconds": 0,
            "most_distracted_period": None,
        }

    def top_warning_domains(self, warnings):
        rows = (
            warnings.exclude(domain="")
            .values("domain")
            .annotate(
                warning_count=Count("id"),
                affected_session_count=Count("session_id", distinct=True),
            )
            .order_by("-warning_count", "-affected_session_count", "domain")[:5]
        )
        return [
            {
                "domain": row["domain"],
                "warning_count": row["warning_count"],
                "affected_session_count": row["affected_session_count"],
            }
            for row in rows
        ]

    def browser_event_averages(self, browser_events, session_count):
        totals = browser_events.aggregate(
            tab_switches=Sum("tab_switch_count"),
            idle_seconds=Sum("idle_seconds"),
        )
        return {
            "average_tab_switches": rounded(
                (totals["tab_switches"] or 0) / session_count
            ),
            "average_idle_seconds": rounded((totals["idle_seconds"] or 0) / session_count),
        }

    def most_distracted_period(self, warnings, session_map):
        buckets = {"early": 0, "middle": 0, "late": 0}
        for warning in warnings.only("session_id", "created_at"):
            session = session_map.get(warning.session_id)
            if not session or not session.started_at:
                continue
            duration_seconds = session.actual_duration_seconds
            if duration_seconds <= 0 and session.ended_at:
                duration_seconds = max(
                    0,
                    int((session.ended_at - session.started_at).total_seconds()),
                )
            if duration_seconds <= 0:
                continue
            elapsed = (warning.created_at - session.started_at).total_seconds()
            if elapsed < 0:
                continue
            ratio = min(elapsed / duration_seconds, 1)
            if ratio < 1 / 3:
                buckets["early"] += 1
            elif ratio < 2 / 3:
                buckets["middle"] += 1
            else:
                buckets["late"] += 1

        if not any(buckets.values()):
            return None
        return sorted(buckets, key=lambda key: (-buckets[key], key))[0]

    def score_trend(self, valid_sessions):
        scores = list(
            valid_sessions.order_by("started_at", "id").values_list(
                "focus_score",
                flat=True,
            )
        )
        midpoint = len(scores) // 2
        first_half = scores[:midpoint]
        second_half = scores[midpoint:]
        first_average = sum(first_half) / len(first_half)
        second_average = sum(second_half) / len(second_half)
        change = rounded(second_average - first_average, 1)
        if abs(change) < 1:
            direction = "stable"
            change = 0
        elif change > 0:
            direction = "up"
        else:
            direction = "down"
        return {"direction": direction, "change": change}


DURATION_RECOMMENDATIONS = {
    "0-29": 25,
    "30-49": 40,
    "50-69": 50,
    "70-89": 75,
    "90+": 90,
}

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}
MODE_API_VALUES = {
    FocusSession.Mode.NORMAL: "normal",
    FocusSession.Mode.DEEP_WORK: "deep_work",
}


class FocusRecommendationService:
    def __init__(
        self,
        user,
        date_range="30d",
        limit=5,
        now=None,
        pattern_service=None,
        pattern_data=None,
    ):
        self.user = user
        self.date_range = date_range
        self.limit = limit
        self.now = now or timezone.now()
        self.pattern_service = pattern_service or PatternDetectionService(
            user,
            date_range=date_range,
            now=self.now,
        )
        self.pattern_data = pattern_data

    def build(self):
        pattern_data = self.pattern_data or self.pattern_service.build()
        if pattern_data["status"] == "insufficient_data":
            return {
                "status": "insufficient_data",
                "minimum_sessions": MINIMUM_SESSIONS,
                "current_sessions": pattern_data["current_sessions"],
                "recommendations": [],
                "smart_preset": None,
            }

        patterns = pattern_data["patterns"]
        base_sessions = self.pattern_service.base_sessions()
        valid_sessions = self.pattern_service.valid_sessions(base_sessions)
        recommendations = self.build_recommendations(patterns, base_sessions, valid_sessions)
        smart_preset = self.build_smart_preset(patterns, recommendations)

        return {
            "status": "ready",
            "session_count": pattern_data["session_count"],
            "period": pattern_data["period"],
            "recommendations": recommendations[: self.limit],
            "smart_preset": smart_preset,
            "generated_at": self.now,
        }

    def build_recommendations(self, patterns, base_sessions, valid_sessions):
        recommendations = [
            self.duration_recommendation(patterns["best_duration"]),
            self.mode_recommendation(base_sessions, valid_sessions),
            self.break_recommendation(patterns),
            self.preferred_time_recommendation(patterns["best_time"]),
        ]
        distraction = self.distraction_recommendation(patterns["distraction_triggers"])
        if distraction:
            recommendations.append(distraction)
        return self.sort_recommendations(
            [recommendation for recommendation in recommendations if recommendation]
        )

    def sort_recommendations(self, recommendations):
        return sorted(
            recommendations,
            key=lambda item: (
                PRIORITY_ORDER[item["priority"]],
                item["type"],
                item["reason_code"],
            ),
        )

    def duration_recommendation(self, best_duration):
        if not best_duration:
            return None
        duration = DURATION_RECOMMENDATIONS.get(best_duration["label"], 50)
        priority = "high" if best_duration["average_score"] >= 80 else "medium"
        confidence = "high" if best_duration["session_count"] >= 5 else "medium"
        return {
            "type": "duration",
            "priority": priority,
            "confidence": confidence,
            "reason_code": "best_duration_bucket",
            "title": f"Try a {duration}-minute focus session",
            "message": (
                f"Your {best_duration['label']}-minute sessions have the strongest "
                "average Focus Score."
            ),
            "recommended_value": duration,
            "unit": "minutes",
            "reason": {
                "average_score": best_duration["average_score"],
                "session_count": best_duration["session_count"],
                "bucket": best_duration["label"],
            },
        }

    def mode_recommendation(self, base_sessions, valid_sessions):
        mode_stats = self.mode_stats(base_sessions, valid_sessions)
        normal = mode_stats.get(FocusSession.Mode.NORMAL)
        deep_work = mode_stats.get(FocusSession.Mode.DEEP_WORK)
        if not normal or not deep_work or normal["session_count"] < 2 or deep_work["session_count"] < 2:
            return {
                "type": "mode",
                "priority": "low",
                "confidence": "low",
                "reason_code": "no_clear_mode_preference",
                "recommended_value": None,
                "reason": {
                    "normal_session_count": normal["session_count"] if normal else 0,
                    "deep_work_session_count": deep_work["session_count"] if deep_work else 0,
                },
            }

        difference = rounded(deep_work["average_score"] - normal["average_score"], 1)
        if abs(difference) < 5:
            return {
                "type": "mode",
                "priority": "low",
                "confidence": "medium",
                "reason_code": "no_clear_mode_preference",
                "recommended_value": None,
                "reason": self.mode_reason(normal, deep_work, difference),
            }

        if difference > 0:
            selected = FocusSession.Mode.DEEP_WORK
            reason_code = "deep_work_outperforms_normal"
        else:
            selected = FocusSession.Mode.NORMAL
            reason_code = "normal_outperforms_deep_work"

        return {
            "type": "mode",
            "priority": "high" if abs(difference) >= 10 else "medium",
            "confidence": "high" if min(normal["session_count"], deep_work["session_count"]) >= 5 else "medium",
            "reason_code": reason_code,
            "recommended_value": MODE_API_VALUES[selected],
            "reason": self.mode_reason(normal, deep_work, difference),
        }

    def mode_stats(self, base_sessions, valid_sessions):
        denominators = {
            row["mode"]: row["total"]
            for row in base_sessions.values("mode").annotate(total=Count("id"))
        }
        stats = {
            row["mode"]: {
                "mode": row["mode"],
                "average_score": rounded(row["average_score"], 1),
                "session_count": row["session_count"],
                "average_actual_minutes": rounded(
                    (row["average_actual_seconds"] or 0) / 60,
                    1,
                ),
                "completion_rate": rounded(
                    row["session_count"] / max(denominators.get(row["mode"], 0), 1) * 100
                ),
                "warning_count": 0,
                "average_warnings": 0,
            }
            for row in valid_sessions.values("mode").annotate(
                average_score=Avg("focus_score"),
                session_count=Count("id"),
                average_actual_seconds=Avg("actual_duration_seconds"),
            )
        }
        session_modes = dict(valid_sessions.values_list("id", "mode"))
        warning_rows = (
            WarningEvent.objects.filter(session_id__in=list(session_modes))
            .values("session_id")
            .annotate(total=Count("id"))
        )
        for row in warning_rows:
            mode = session_modes.get(row["session_id"])
            if mode in stats:
                stats[mode]["warning_count"] += row["total"]
        for mode, values in stats.items():
            values["average_warnings"] = rounded(
                values["warning_count"] / values["session_count"]
            )
        return stats

    def mode_reason(self, normal, deep_work, difference):
        return {
            "deep_work_average_score": deep_work["average_score"],
            "normal_average_score": normal["average_score"],
            "difference": difference,
            "deep_work_completion_rate": deep_work["completion_rate"],
            "normal_completion_rate": normal["completion_rate"],
            "deep_work_average_warnings": deep_work["average_warnings"],
            "normal_average_warnings": normal["average_warnings"],
            "deep_work_average_actual_minutes": deep_work["average_actual_minutes"],
            "normal_average_actual_minutes": normal["average_actual_minutes"],
        }

    def break_recommendation(self, patterns):
        duration = self.recommended_duration(patterns["best_duration"])
        if duration <= 30:
            break_minutes = 5
        elif duration <= 60:
            break_minutes = 10
        elif duration <= 90:
            break_minutes = 15
        else:
            break_minutes = 20

        distractions = patterns["distraction_triggers"]
        if (
            distractions["most_distracted_period"] == "late"
            or distractions["average_idle_seconds"] >= 120
        ):
            break_minutes = min(break_minutes + 5, 20)

        return {
            "type": "break",
            "priority": "medium",
            "confidence": "medium",
            "reason_code": "recommended_break_after_session",
            "recommended_value": break_minutes,
            "unit": "minutes",
            "reason": {"duration_minutes": duration},
        }

    def preferred_time_recommendation(self, best_time):
        if not best_time:
            return None
        confidence = "high" if best_time["session_count"] >= 5 else "medium"
        return {
            "type": "preferred_time",
            "priority": "medium",
            "confidence": confidence,
            "reason_code": "best_focus_time",
            "recommended_value": {
                "label": best_time["label"],
                "start_hour": best_time["start_hour"],
                "end_hour": best_time["end_hour"],
            },
            "reason": {
                "average_score": best_time["average_score"],
                "session_count": best_time["session_count"],
            },
        }

    def distraction_recommendation(self, distractions):
        if distractions["top_domains"]:
            domain = distractions["top_domains"][0]
            if domain["warning_count"] >= 2 and not self.is_blacklisted(domain["domain"]):
                return {
                    "type": "distraction",
                    "priority": "high",
                    "confidence": "high" if domain["affected_session_count"] >= 3 else "medium",
                    "reason_code": "high_warning_domain",
                    "title": f"Reduce visits to {domain['domain']} during sessions",
                    "message": (
                        f"This domain caused {domain['warning_count']} warnings across "
                        f"{domain['affected_session_count']} sessions."
                    ),
                    "recommended_action": "add_to_blacklist",
                    "domain": domain["domain"],
                    "reason": {
                        "warning_count": domain["warning_count"],
                        "affected_session_count": domain["affected_session_count"],
                    },
                }

        if distractions["average_tab_switches"] >= 5:
            return {
                "type": "distraction",
                "priority": "medium",
                "confidence": "medium",
                "reason_code": "high_tab_switch_frequency",
                "recommended_action": "reduce_tab_switching",
                "reason": {"average_tab_switches": distractions["average_tab_switches"]},
            }

        if distractions["most_distracted_period"] == "late":
            return {
                "type": "distraction",
                "priority": "medium",
                "confidence": "medium",
                "reason_code": "warnings_in_last_third",
                "recommended_action": "shorten_or_add_break",
                "reason": {"most_distracted_period": "late"},
            }

        return None

    def is_blacklisted(self, domain):
        normalized = normalize_domain(domain)
        return BlacklistEntry.objects.available_to(self.user).filter(
            domain=normalized
        ).exists()

    def build_smart_preset(self, patterns, recommendations):
        mode = "normal"
        mode_recommendation = self.find_recommendation(recommendations, "mode")
        if mode_recommendation and mode_recommendation.get("recommended_value"):
            mode = mode_recommendation["recommended_value"]

        return {
            "mode": mode,
            "duration_minutes": self.recommended_duration(patterns["best_duration"]),
            "break_minutes": self.break_minutes_from_recommendations(recommendations),
            "preferred_time": self.preferred_time_value(patterns["best_time"]),
            "confidence": self.smart_preset_confidence(recommendations),
            "personalized": True,
        }

    def recommended_duration(self, best_duration):
        if not best_duration:
            return 50
        return DURATION_RECOMMENDATIONS.get(best_duration["label"], 50)

    def break_minutes_from_recommendations(self, recommendations):
        recommendation = self.find_recommendation(recommendations, "break")
        return recommendation["recommended_value"] if recommendation else 10

    def preferred_time_value(self, best_time):
        if not best_time:
            return None
        return {
            "label": best_time["label"],
            "start_hour": best_time["start_hour"],
            "end_hour": best_time["end_hour"],
        }

    def smart_preset_confidence(self, recommendations):
        if any(item["confidence"] == "high" for item in recommendations):
            return "high"
        if any(item["confidence"] == "medium" for item in recommendations):
            return "medium"
        return "low"

    def find_recommendation(self, recommendations, recommendation_type):
        return next(
            (item for item in recommendations if item["type"] == recommendation_type),
            None,
        )

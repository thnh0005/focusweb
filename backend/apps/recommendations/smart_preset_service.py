from django.utils import timezone

from apps.sessions.models import FocusSession
from apps.users.models import UserPreference

from .services import (
    DURATION_RECOMMENDATIONS,
    MINIMUM_SESSIONS,
    VALID_RANGES,
    FocusRecommendationService,
    PatternDetectionService,
)


SMART_PRESET_VERSION = "v1"
SYSTEM_DEFAULT_MODE = "normal"
SYSTEM_DEFAULT_DURATION = 25
FRIENDLY_DURATIONS = {25, 40, 50, 60, 75, 90}
MODE_API_TO_MODEL = {
    "normal": FocusSession.Mode.NORMAL,
    "deep_work": FocusSession.Mode.DEEP_WORK,
}
MODE_MODEL_TO_API = {
    FocusSession.Mode.NORMAL: "normal",
    FocusSession.Mode.DEEP_WORK: "deep_work",
}


class SmartPresetService:
    def __init__(
        self,
        user,
        date_range="30d",
        now=None,
        pattern_service_cls=None,
        recommendation_service_cls=None,
    ):
        if date_range not in VALID_RANGES:
            raise ValueError("Unsupported date range.")
        self.user = user
        self.date_range = date_range
        self.now = now or timezone.now()
        self.pattern_service_cls = pattern_service_cls or PatternDetectionService
        self.recommendation_service_cls = recommendation_service_cls or FocusRecommendationService

    def build_for_user(self):
        pattern_service = self.pattern_service_cls(
            self.user,
            date_range=self.date_range,
            now=self.now,
        )
        pattern_data = pattern_service.build()
        if pattern_data["status"] == "insufficient_data":
            return self.insufficient_data_response(pattern_data)

        recommendation_data = self.recommendation_service_cls(
            self.user,
            date_range=self.date_range,
            limit=10,
            now=self.now,
            pattern_service=pattern_service,
            pattern_data=pattern_data,
        ).build()
        patterns = pattern_data["patterns"]
        recommendations = recommendation_data.get("recommendations", [])
        preset = self.build_personalized_preset(patterns, recommendations)
        reason_codes = self.reason_codes(preset, recommendations, patterns)
        preset["reason_codes"] = reason_codes
        return {
            "status": "ready",
            "personalized": True,
            "session_count": pattern_data["session_count"],
            "range": self.date_range,
            "preset_version": SMART_PRESET_VERSION,
            "preset": preset,
            "rationale": self.rationale(reason_codes),
            "generated_at": self.now,
        }

    def insufficient_data_response(self, pattern_data):
        mode, duration, fallback_code = self.preference_fallback()
        preset = {
            "mode": mode,
            "requires_goal": mode == "deep_work",
            "duration_minutes": duration,
            "break_minutes": self.break_for_duration(duration),
            "preferred_time": None,
            "confidence": "default",
            "reason_codes": ["insufficient_history", fallback_code],
        }
        return {
            "status": "insufficient_data",
            "personalized": False,
            "minimum_sessions": MINIMUM_SESSIONS,
            "current_sessions": pattern_data["current_sessions"],
            "range": self.date_range,
            "preset_version": SMART_PRESET_VERSION,
            "preset": preset,
            "rationale": self.rationale(preset["reason_codes"]),
            "generated_at": self.now,
        }

    def build_personalized_preset(self, patterns, recommendations):
        mode, mode_reason = self.select_mode(recommendations)
        duration = self.select_duration(patterns, recommendations)
        break_minutes = self.select_break(duration, recommendations)
        preferred_time = self.select_preferred_time(patterns, recommendations)
        confidence = self.confidence(patterns, recommendations)
        return {
            "mode": mode,
            "requires_goal": mode == "deep_work",
            "duration_minutes": duration,
            "break_minutes": break_minutes,
            "preferred_time": preferred_time,
            "confidence": confidence,
            "_mode_reason": mode_reason,
        }

    def select_mode(self, recommendations):
        mode_recommendation = self.find_recommendation(recommendations, "mode")
        if mode_recommendation and mode_recommendation.get("recommended_value") in {
            "normal",
            "deep_work",
        }:
            return mode_recommendation["recommended_value"], mode_recommendation["reason_code"]
        preference = self.preference()
        if preference:
            mode = MODE_MODEL_TO_API.get(preference.default_mode)
            if mode:
                return mode, "user_preference_fallback"
        return SYSTEM_DEFAULT_MODE, (
            mode_recommendation["reason_code"]
            if mode_recommendation
            else "system_default_fallback"
        )

    def select_duration(self, patterns, recommendations):
        duration_recommendation = self.find_recommendation(recommendations, "duration")
        if duration_recommendation:
            duration = duration_recommendation.get("recommended_value")
            if self.valid_duration(duration):
                return int(duration)
        best_duration = patterns.get("best_duration")
        if best_duration:
            return DURATION_RECOMMENDATIONS.get(best_duration["label"], 50)
        preference = self.preference()
        if preference and self.valid_duration(preference.default_duration_minutes):
            return int(preference.default_duration_minutes)
        return SYSTEM_DEFAULT_DURATION

    def select_break(self, duration, recommendations):
        break_recommendation = self.find_recommendation(recommendations, "break")
        if break_recommendation:
            value = break_recommendation.get("recommended_value")
            if isinstance(value, int) and 0 < value <= min(duration, 30):
                return value
        return self.break_for_duration(duration)

    def select_preferred_time(self, patterns, recommendations):
        time_recommendation = self.find_recommendation(recommendations, "preferred_time")
        if time_recommendation:
            value = time_recommendation.get("recommended_value")
            if self.valid_time_bucket(value):
                return value
        best_time = patterns.get("best_time")
        if best_time and best_time.get("session_count", 0) >= 2:
            return {
                "label": best_time["label"],
                "start_hour": best_time["start_hour"],
                "end_hour": best_time["end_hour"],
            }
        return None

    def confidence(self, patterns, recommendations):
        best_duration = patterns.get("best_duration") or {}
        best_time = patterns.get("best_time") or {}
        supporting_count = max(
            best_duration.get("session_count", 0),
            best_time.get("session_count", 0),
        )
        if supporting_count >= 5 and any(
            item.get("confidence") == "high" for item in recommendations
        ):
            return "high"
        if supporting_count >= 3 or any(
            item.get("confidence") == "medium" for item in recommendations
        ):
            return "medium"
        return "low"

    def reason_codes(self, preset, recommendations, patterns):
        codes = []
        duration = self.find_recommendation(recommendations, "duration")
        if duration:
            codes.append(duration["reason_code"])
        mode_reason = preset.pop("_mode_reason", "")
        if mode_reason:
            codes.append(mode_reason)
        if self.find_recommendation(recommendations, "preferred_time") or preset["preferred_time"]:
            codes.append("best_focus_time")
        if self.find_recommendation(recommendations, "break"):
            codes.append("recommended_break_after_session")
        return self.unique_codes(codes)

    def preference_fallback(self):
        preference = self.preference()
        if preference:
            mode = MODE_MODEL_TO_API.get(preference.default_mode, SYSTEM_DEFAULT_MODE)
            duration = (
                int(preference.default_duration_minutes)
                if self.valid_duration(preference.default_duration_minutes)
                else SYSTEM_DEFAULT_DURATION
            )
            return mode, duration, "user_preference_fallback"
        return SYSTEM_DEFAULT_MODE, SYSTEM_DEFAULT_DURATION, "system_default_fallback"

    def preference(self):
        return UserPreference.objects.filter(user=self.user).first()

    def valid_duration(self, value):
        return isinstance(value, int) and value > 0 and value <= 180

    def break_for_duration(self, duration):
        if duration <= 30:
            return 5
        if duration <= 60:
            return 10
        if duration <= 90:
            return 15
        return min(20, max(5, duration - 1))

    def valid_time_bucket(self, value):
        if not isinstance(value, dict):
            return False
        start = value.get("start_hour")
        end = value.get("end_hour")
        return isinstance(start, int) and isinstance(end, int) and 0 <= start <= end <= 23

    def find_recommendation(self, recommendations, recommendation_type):
        return next(
            (item for item in recommendations if item.get("type") == recommendation_type),
            None,
        )

    def unique_codes(self, codes):
        unique = []
        for code in codes:
            if code and code not in unique:
                unique.append(code)
        return unique

    def rationale(self, reason_codes):
        messages = {
            "insufficient_history": "Complete at least 5 sessions to unlock a personalized preset.",
            "user_preference_fallback": "Using your saved session preference until more history is available.",
            "system_default_fallback": "Using the default focus preset until more history is available.",
            "best_duration_bucket": "Your strongest duration bucket is used for this preset.",
            "deep_work_outperforms_normal": "Deep Work has performed better than Normal mode in your recent sessions.",
            "normal_outperforms_deep_work": "Normal mode has performed better than Deep Work in your recent sessions.",
            "no_clear_mode_preference": "There is no clear mode preference in your recent history.",
            "best_focus_time": "Your strongest focus time bucket is included.",
            "recommended_break_after_session": "Break length is matched to the recommended session duration.",
        }
        return [
            {
                "reason_code": code,
                "message": messages.get(code, "This preset uses your aggregate focus history."),
            }
            for code in self.unique_codes(reason_codes)
        ]

from django.apps import apps
from django.db import transaction
from rest_framework.exceptions import APIException, NotFound, PermissionDenied

from apps.ai.services.semantic_service import SemanticAnalysisService
from apps.scoring.services import HybridDecisionEngine, HybridDecisionValidationError
from apps.tracking.models import BrowserEvent, EventBatch
from apps.tracking.services.behavior_rule_engine import BehaviorRuleEngine
from apps.tracking.services.warning_cycle_service import WarningCycleService


class SessionValidationUnavailable(APIException):
    status_code = 503
    default_detail = "Focus session validation is unavailable."
    default_code = "session_validation_unavailable"


class SessionNotActive(APIException):
    status_code = 409
    default_detail = "Browser events are accepted only for active sessions."
    default_code = "session_not_active"


class EventIngestService:
    ACTIVE_STATUS = "active"
    STATUS_FIELDS = ("status", "state", "session_status")

    @staticmethod
    def get_focus_session_model():
        try:
            return apps.get_model("focus_sessions", "FocusSession")
        except LookupError as exc:
            raise SessionValidationUnavailable() from exc

    @classmethod
    def get_user_session_or_error(cls, user, session_id):
        focus_session_model = cls.get_focus_session_model()
        session = (
            focus_session_model.objects.select_for_update()
            .filter(pk=session_id)
            .first()
        )
        if session is None:
            raise NotFound("Session was not found.")

        if getattr(session, "user_id", None) != user.pk:
            raise PermissionDenied("Session does not belong to the authenticated user.")

        return session

    @classmethod
    def normalize_status(cls, value):
        if value is None:
            return ""
        if hasattr(value, "value"):
            value = value.value
        return str(value).strip().lower()

    @classmethod
    def get_session_status(cls, session):
        for field in cls.STATUS_FIELDS:
            if hasattr(session, field):
                return getattr(session, field)
        return None

    @classmethod
    def is_session_active(cls, session) -> bool:
        return cls.normalize_status(cls.get_session_status(session)) == cls.ACTIVE_STATUS

    @classmethod
    def ensure_session_accepts_tracking(cls, user, session_id):
        session = cls.get_user_session_or_error(user, session_id)
        if not cls.is_session_active(session):
            raise SessionNotActive(
                {"session_id": ["Browser events are accepted only for active sessions."]}
            )
        return session

    @classmethod
    def ingest_batch(cls, user, session_id, events: list, rejected_count=0) -> dict:
        with transaction.atomic():
            session = cls.ensure_session_accepts_tracking(user, session_id)
            batch = EventBatch.objects.create(
                session_id=session_id,
                batch_size=len(events) + rejected_count,
            )
            browser_events = [
                BrowserEvent(
                    session_id=session_id,
                    **event,
                )
                for event in events
            ]
            BrowserEvent.objects.bulk_create(browser_events)

        rule_engine = BehaviorRuleEngine()
        rule_evaluations = [
            {
                "event_index": index,
                "event_type": event.get("event_type", ""),
                "result": rule_engine.evaluate_event(
                    user=user,
                    event=event,
                    mode=getattr(session, "mode", ""),
                ),
            }
            for index, event in enumerate(events)
        ]
        semantic_service = SemanticAnalysisService()
        semantic_evaluations = [
            {
                "event_index": index,
                "event_type": browser_event.event_type,
                "result": semantic_service.analyze_event_safe(
                    user=user,
                    session=session,
                    browser_event=browser_event,
                ),
            }
            for index, browser_event in enumerate(browser_events)
        ]
        ai_metadata = cls.build_ai_metadata(semantic_evaluations)
        hybrid_engine = HybridDecisionEngine()
        hybrid_decisions = [
            {
                "event_index": rule_evaluation["event_index"],
                "event_type": rule_evaluation["event_type"],
                "result": cls.evaluate_hybrid_decision_safe(
                    hybrid_engine=hybrid_engine,
                    rule_result=rule_evaluation["result"],
                    semantic_result=semantic_evaluations[index]["result"],
                    session_mode=getattr(session, "mode", ""),
                ),
            }
            for index, rule_evaluation in enumerate(rule_evaluations)
        ]
        warning_cycle_service = WarningCycleService()
        warning_cycles = [
            {
                "event_index": index,
                "event_type": browser_event.event_type,
                "result": warning_cycle_service.handle_decision(
                    session=session,
                    decision=hybrid_decision["result"],
                    source_event=browser_event,
                    domain=browser_event.domain,
                ),
            }
            for index, (browser_event, hybrid_decision) in enumerate(
                zip(browser_events, hybrid_decisions)
            )
        ]

        return {
            "status": "ok",
            "batch_id": batch.id,
            "accepted_count": len(events),
            "rejected_count": rejected_count,
            "rule_evaluations": rule_evaluations,
            "semantic_evaluations": semantic_evaluations,
            "hybrid_decisions": hybrid_decisions,
            "warning_cycles": warning_cycles,
            "ai": ai_metadata,
        }

    @staticmethod
    def evaluate_hybrid_decision_safe(
        hybrid_engine,
        rule_result,
        semantic_result,
        session_mode,
    ) -> dict:
        try:
            return hybrid_engine.decide(
                rule_evaluation=rule_result,
                semantic_analysis=semantic_result,
                session_mode=session_mode,
            )
        except HybridDecisionValidationError as exc:
            return {
                "status": "error",
                "error_code": "HYBRID_INVALID_INPUT",
                "reason": str(exc),
            }

    @staticmethod
    def build_ai_metadata(semantic_evaluations: list[dict]) -> dict:
        success_count = 0
        fallback_count = 0
        for item in semantic_evaluations:
            result = item.get("result") or {}
            if result.get("available") is True or result.get("status") in {
                "ok",
                "existing",
            }:
                success_count += 1
            elif result.get("source") == "UNAVAILABLE":
                fallback_count += 1
        return {
            "status": "DEGRADED" if fallback_count else "OK",
            "success_count": success_count,
            "fallback_count": fallback_count,
        }

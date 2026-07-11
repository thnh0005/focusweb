from django.conf import settings
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
            client_event_ids = [
                event["client_event_id"]
                for event in events
                if event.get("client_event_id") is not None
            ]
            existing_client_event_ids = set(
                BrowserEvent.objects.filter(
                    session_id=session_id,
                    client_event_id__in=client_event_ids,
                ).values_list("client_event_id", flat=True)
            )
            deduped_events = []
            seen_client_event_ids = set()
            duplicate_count = 0
            for event in events:
                client_event_id = event.get("client_event_id")
                if client_event_id is not None and (
                    client_event_id in existing_client_event_ids
                    or client_event_id in seen_client_event_ids
                ):
                    duplicate_count += 1
                    continue
                if client_event_id is not None:
                    seen_client_event_ids.add(client_event_id)
                deduped_events.append(event)
            browser_events = [
                BrowserEvent(
                    session_id=session_id,
                    **event,
                )
                for event in deduped_events
            ]
            BrowserEvent.objects.bulk_create(browser_events, ignore_conflicts=True)
            inserted_event_ids = set(
                BrowserEvent.objects.filter(
                    id__in=[browser_event.id for browser_event in browser_events]
                ).values_list("id", flat=True)
            )
            if len(inserted_event_ids) != len(browser_events):
                duplicate_count += len(browser_events) - len(inserted_event_ids)
                deduped_pairs = [
                    (event, browser_event)
                    for event, browser_event in zip(deduped_events, browser_events)
                    if browser_event.id in inserted_event_ids
                ]
                deduped_events = [event for event, _browser_event in deduped_pairs]
                browser_events = [
                    browser_event for _event, browser_event in deduped_pairs
                ]

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
            for index, event in enumerate(deduped_events)
        ]
        if settings.AI_SEMANTIC_REALTIME_ENABLED:
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
        else:
            semantic_evaluations = [
                {
                    "event_index": index,
                    "event_type": browser_event.event_type,
                    "result": {
                        "status": "skipped",
                        "available": False,
                        "reason": "realtime_ai_disabled",
                        "source": "DISABLED",
                        "error_code": "REALTIME_AI_DISABLED",
                    },
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
            "accepted_count": len(browser_events),
            "rejected_count": rejected_count,
            "duplicate_count": duplicate_count,
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
        disabled_count = 0
        for item in semantic_evaluations:
            result = item.get("result") or {}
            if result.get("source") == "DISABLED":
                disabled_count += 1
                fallback_count += 1
            elif result.get("available") is True or result.get("status") in {
                "ok",
                "existing",
            }:
                success_count += 1
            elif result.get("source") == "UNAVAILABLE":
                fallback_count += 1
        return {
            "status": (
                "DISABLED"
                if disabled_count and disabled_count == len(semantic_evaluations)
                else "DEGRADED" if fallback_count else "OK"
            ),
            "success_count": success_count,
            "fallback_count": fallback_count,
            "disabled_count": disabled_count,
        }

from django.apps import apps
from django.db import transaction
from rest_framework.exceptions import APIException, NotFound, PermissionDenied

from apps.tracking.models import BrowserEvent, EventBatch


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
    @transaction.atomic
    def ingest_batch(cls, user, session_id, events: list, rejected_count=0) -> dict:
        cls.ensure_session_accepts_tracking(user, session_id)

        batch = EventBatch.objects.create(
            session_id=session_id,
            batch_size=len(events) + rejected_count,
        )
        BrowserEvent.objects.bulk_create(
            [
                BrowserEvent(
                    session_id=session_id,
                    **event,
                )
                for event in events
            ]
        )

        return {
            "status": "ok",
            "batch_id": batch.id,
            "accepted_count": len(events),
            "rejected_count": rejected_count,
        }

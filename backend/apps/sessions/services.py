from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.users.models import Profile

from .models import FocusSession, SessionNote, SessionStateTransition, SessionTag


ALLOWED_TRANSITIONS = {
    FocusSession.Status.ACTIVE: {
        FocusSession.Status.PAUSED,
        FocusSession.Status.AUTO_PAUSED,
        FocusSession.Status.COMPLETED,
        FocusSession.Status.CANCELLED,
    },
    FocusSession.Status.PAUSED: {
        FocusSession.Status.ACTIVE,
        FocusSession.Status.COMPLETED,
        FocusSession.Status.CANCELLED,
    },
    FocusSession.Status.AUTO_PAUSED: {
        FocusSession.Status.ACTIVE,
        FocusSession.Status.COMPLETED,
        FocusSession.Status.CANCELLED,
    },
}


def set_session_tags(session, tag_names):
    normalized_names = []
    for name in tag_names:
        normalized = name.strip()
        if normalized and normalized.casefold() not in {
            item.casefold() for item in normalized_names
        }:
            normalized_names.append(normalized)

    if len(normalized_names) > 3:
        raise ValidationError({"tags": ["A session can have at most 3 tags."]})

    tags = [
        SessionTag.objects.get_or_create(user=session.user, name=name)[0]
        for name in normalized_names
    ]
    session.tags.set(tags)


@transaction.atomic
def transition_session(session, target_status, note=None, tags=None):
    locked = (
        FocusSession.objects.select_for_update()
        .select_related("user")
        .get(pk=session.pk, user=session.user)
    )

    if locked.status == target_status:
        return locked
    if target_status not in ALLOWED_TRANSITIONS.get(locked.status, set()):
        raise ValidationError(
            {
                "status": [
                    f"Cannot transition session from {locked.status} to {target_status}."
                ]
            }
        )

    now = timezone.now()
    previous_status = locked.status

    if target_status in {FocusSession.Status.PAUSED, FocusSession.Status.AUTO_PAUSED}:
        locked.paused_at = now
    elif target_status == FocusSession.Status.ACTIVE:
        if locked.paused_at:
            paused_for = max(0, int((now - locked.paused_at).total_seconds()))
            locked.accumulated_paused_seconds += paused_for
        locked.paused_at = None
    elif target_status in {FocusSession.Status.COMPLETED, FocusSession.Status.CANCELLED}:
        locked.actual_duration_seconds = locked.calculate_actual_duration(now)
        locked.ended_at = now
        locked.paused_at = None

    locked.status = target_status
    locked.save()
    SessionStateTransition.objects.create(
        session=locked,
        from_status=previous_status,
        to_status=target_status,
    )

    if note is not None:
        SessionNote.objects.update_or_create(
            session=locked,
            defaults={"content": note},
        )
    if tags is not None:
        set_session_tags(locked, tags)

    if target_status == FocusSession.Status.COMPLETED:
        Profile.objects.filter(user=locked.user).update(
            total_sessions=F("total_sessions") + 1,
            total_focus_minutes=F("total_focus_minutes")
            + locked.actual_duration_seconds // 60,
        )

    return locked


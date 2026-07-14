from django.db import transaction
from django.db.models import F
from django.db.models.functions import Trim
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.scoring.services.score_calculator import ScoreCalculator
from apps.users.models import Profile, UserPreference

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
    """Chuẩn hóa tên tag và chỉ gắn tối đa 3 tag thuộc về người dùng."""
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
def transition_session(
    session,
    target_status,
    note=None,
    tags=None,
    reason="",
    metadata=None,
    allowed_from_statuses=None,
):
    """Chuyển trạng thái session bằng một lần ghi DB có khóa.

    Đây là lõi lifecycle của tuần 1. Tuần 2 gắn thêm bước tính final score
    khi session hoàn thành để summary, history và dashboard dùng cùng dữ liệu.
    """
    locked = (
        FocusSession.objects.select_for_update()
        .select_related("user")
        .get(pk=session.pk, user=session.user)
    )

    if allowed_from_statuses is not None and locked.status not in allowed_from_statuses:
        raise ValidationError(
            {
                "status": [
                    f"Cannot transition session from {locked.status} to {target_status}."
                ]
            }
        )
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
        # Lưu thời điểm bắt đầu pause; khi resume/end backend sẽ trừ khoảng
        # này để actual duration luôn do server tính.
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
        if reason:
            locked.end_reason = reason
        if metadata is not None:
            locked.end_metadata = metadata

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
        # Lưu điểm trước khi cập nhật tổng profile để màn summary đọc được
        # đầy đủ score ngay sau khi endpoint /end/ trả về.
        ScoreCalculator().persist_final_score(locked)
        from apps.ai.models import SessionInsight

        SessionInsight.objects.get_or_create(
            session=locked,
            defaults={"status": SessionInsight.Status.PENDING},
        )
        Profile.objects.filter(user=locked.user).update(
            total_sessions=F("total_sessions") + 1,
            total_focus_minutes=F("total_focus_minutes")
            + locked.actual_duration_seconds // 60,
        )
        transaction.on_commit(lambda: enqueue_session_insight(locked.id))

    return locked


def enqueue_session_insight(session_id):
    from apps.ai.tasks import generate_session_insight

    try:
        generate_session_insight.delay(str(session_id))
    except Exception:
        return None


class RecentLearningContextService:
    """Builds safe reuse context from session history without notes or event content."""

    HISTORICAL_STATUSES = [FocusSession.Status.COMPLETED, "finished"]
    MODE_MAP = {
        FocusSession.Mode.NORMAL: "normal",
        FocusSession.Mode.DEEP_WORK: "deep_work",
        "deep_work": "deep_work",
    }

    def __init__(self, user):
        self.user = user
        self.generated_at = timezone.now()

    def build(self):
        recent_session = self.recent_completed_session()
        active_session = self.active_session()
        active_data = self.serialize_active_session(active_session)

        if recent_session is None:
            return {
                "status": "empty",
                "has_context": False,
                "recent_context": None,
                "reuse_config": None,
                "active_session": active_data,
                "generated_at": self.generated_at,
            }

        recent_context = self.serialize_recent_context(recent_session)
        return {
            "status": "ready",
            "has_context": True,
            "recent_context": recent_context,
            "reuse_config": self.build_reuse_config(recent_session, recent_context),
            "active_session": active_data,
            "generated_at": self.generated_at,
        }

    def recent_completed_session(self):
        return (
            FocusSession.objects.filter(
                user=self.user,
                status__in=self.HISTORICAL_STATUSES,
            )
            .annotate(trimmed_goal=Trim("goal"))
            .exclude(trimmed_goal="")
            .prefetch_related("tags")
            .order_by(
                F("ended_at").desc(nulls_last=True),
                F("started_at").desc(nulls_last=True),
                "-created_at",
            )
            .first()
        )

    def active_session(self):
        return (
            FocusSession.objects.filter(
                user=self.user,
                status__in=FocusSession.OPEN_STATUSES,
            )
            .order_by("-started_at", "-created_at")
            .first()
        )

    def serialize_recent_context(self, session):
        tags = self.serialize_tags(session)
        return {
            "session_id": session.id,
            "goal": self.normalize_goal(session.goal),
            "mode": self.normalize_mode(session.mode),
            "target_duration_minutes": self.target_duration_minutes(session),
            "actual_duration_minutes": self.actual_duration_minutes(session),
            "session_status": session.status,
            "started_at": session.started_at,
            "ended_at": session.ended_at,
            "tags": tags,
        }

    def serialize_active_session(self, session):
        if session is None:
            return None
        return {
            "session_id": session.id,
            "goal": self.normalize_goal(session.goal),
            "mode": self.normalize_mode(session.mode),
            "target_duration_minutes": self.target_duration_minutes(session),
            "session_status": session.status,
            "started_at": session.started_at,
        }

    def build_reuse_config(self, session, recent_context):
        mode = recent_context["mode"]
        return {
            "goal": recent_context["goal"],
            "mode": mode,
            "requires_goal": mode == "deep_work",
            "duration_minutes": self.target_duration_minutes(session),
            "tag_ids": [str(tag["id"]) for tag in recent_context["tags"]],
        }

    def serialize_tags(self, session):
        tags = session.tags.filter(user=self.user).order_by("name")[:3]
        return [{"id": tag.id, "name": tag.name} for tag in tags]

    @staticmethod
    def normalize_goal(goal):
        return (goal or "").replace("\x00", "").replace("\r\n", "\n").replace(
            "\r",
            "\n",
        ).strip()

    def normalize_mode(self, mode):
        if mode in self.MODE_MAP:
            return self.MODE_MAP[mode]

        preference_mode = self.preference_mode()
        if preference_mode in self.MODE_MAP:
            return self.MODE_MAP[preference_mode]
        return "normal"

    def target_duration_minutes(self, session):
        seconds = getattr(session, "target_duration_seconds", None)
        if seconds and seconds > 0:
            return max(1, round(seconds / 60))
        return self.default_duration_minutes()

    def actual_duration_minutes(self, session):
        seconds = getattr(session, "actual_duration_seconds", None)
        if seconds and seconds > 0:
            return max(0, round(seconds / 60))
        if (
            session.started_at
            and session.ended_at
            and session.ended_at >= session.started_at
        ):
            seconds = (session.ended_at - session.started_at).total_seconds()
            return max(0, round(seconds / 60))
        return None

    def preference_mode(self):
        try:
            return self.user.preferences.default_mode
        except UserPreference.DoesNotExist:
            return FocusSession.Mode.NORMAL

    def default_duration_minutes(self):
        try:
            duration = self.user.preferences.default_duration_minutes
        except UserPreference.DoesNotExist:
            duration = None
        if duration and duration > 0:
            return duration
        return 25


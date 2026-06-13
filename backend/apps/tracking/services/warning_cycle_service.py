from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.sessions.models import FocusSession
from apps.tracking.models import WarningCycle, WarningEvent


DECISION_FOCUSED = "FOCUSED"
DECISION_POTENTIALLY_DISTRACTED = "POTENTIALLY_DISTRACTED"
DECISION_DISTRACTED = "DISTRACTED"


class WarningCycleService:
    WARNING_TYPE_BY_MODE = {
        FocusSession.Mode.DEEP_WORK: WarningEvent.WarningType.DEEP_WORK_AI,
        FocusSession.Mode.NORMAL: WarningEvent.WarningType.NORMAL_BLACKLIST,
    }

    STATUS_BY_LEVEL = {
        1: WarningCycle.Status.WARNING_1_SENT,
        2: WarningCycle.Status.WARNING_2_SENT,
        3: WarningCycle.Status.WARNING_3_SENT,
    }

    def __init__(self, interval_seconds=None, max_level=None):
        self.interval_seconds = (
            interval_seconds
            if interval_seconds is not None
            else settings.WARNING_INTERVAL_SECONDS
        )
        self.max_level = max_level if max_level is not None else settings.WARNING_MAX_LEVEL

    def handle_decision(
        self,
        session,
        decision: dict,
        source_event=None,
        domain="",
        decided_at=None,
    ) -> dict | None:
        decided_at = decided_at or timezone.now()
        state = str((decision or {}).get("state") or "").strip().upper()
        if (
            source_event is not None
            and getattr(source_event, "session_id", None) != session.id
        ):
            return None
        if state in {DECISION_FOCUSED, DECISION_POTENTIALLY_DISTRACTED}:
            return self.resolve_active_cycle(session, decided_at)
        if state != DECISION_DISTRACTED:
            return None
        if session.status != FocusSession.Status.ACTIVE:
            return None
        return self.start_cycle(
            session=session,
            decision=decision,
            source_event=source_event,
            domain=domain,
            now=decided_at,
        )

    @transaction.atomic
    def start_cycle(self, session, decision, source_event=None, domain="", now=None):
        now = now or timezone.now()
        active_cycle = (
            WarningCycle.objects.select_for_update()
            .active()
            .filter(session_id=session.id)
            .order_by("-started_at")
            .first()
        )
        if active_cycle:
            return self.serialize_cycle(active_cycle)

        idempotency_key = self.build_idempotency_key(
            session=session,
            decision=decision,
            source_event=source_event,
        )
        cycle = WarningCycle.objects.filter(idempotency_key=idempotency_key).first()
        if cycle:
            return self.serialize_cycle(cycle)

        next_warning_at = now + timedelta(seconds=self.interval_seconds)
        try:
            cycle = WarningCycle.objects.create(
                session_id=session.id,
                source_event=source_event,
                idempotency_key=idempotency_key,
                mode=session.mode,
                status=WarningCycle.Status.WARNING_1_SENT,
                current_level=1,
                decision_state=decision.get("state", ""),
                decision_source=decision.get("decision_source", ""),
                decision_score=self.clamp_decision_score(decision.get("decision_score")),
                reason_codes=list(decision.get("reason_codes") or []),
                domain=(domain or "")[:255],
                next_warning_at=next_warning_at,
            )
        except IntegrityError:
            cycle = (
                WarningCycle.objects.select_for_update()
                .active()
                .filter(session_id=session.id)
                .order_by("-started_at")
                .first()
            ) or WarningCycle.objects.get(idempotency_key=idempotency_key)

        self.create_warning_event(cycle=cycle, level=1, session=session)
        transaction.on_commit(lambda: self.schedule_advance(cycle.id))
        return self.serialize_cycle(cycle)

    @transaction.atomic
    def advance_cycle(self, cycle_id, now=None):
        now = now or timezone.now()
        cycle = (
            WarningCycle.objects.select_for_update()
            .active()
            .filter(pk=cycle_id)
            .first()
        )
        if cycle is None:
            return None
        if cycle.current_level >= self.max_level:
            return self.serialize_cycle(cycle)
        if cycle.next_warning_at and now < cycle.next_warning_at:
            return self.serialize_cycle(cycle)

        session = FocusSession.objects.filter(pk=cycle.session_id).first()
        if session is None or session.status != FocusSession.Status.ACTIVE:
            return self.serialize_cycle(cycle)

        next_level = cycle.current_level + 1
        cycle.current_level = next_level
        cycle.status = self.STATUS_BY_LEVEL[next_level]
        if next_level >= self.max_level:
            cycle.next_warning_at = None
            if cycle.mode == FocusSession.Mode.DEEP_WORK:
                cycle.status = WarningCycle.Status.AUTO_PAUSE_REQUIRED
                cycle.auto_pause_required = True
                cycle.action = WarningCycle.Action.AUTO_PAUSE
            else:
                cycle.status = WarningCycle.Status.COMPLETED
                cycle.auto_pause_required = False
                cycle.action = WarningCycle.Action.NONE
        else:
            cycle.next_warning_at = now + timedelta(seconds=self.interval_seconds)
        cycle.save()

        self.create_warning_event(cycle=cycle, level=next_level, session=session)
        if next_level < self.max_level:
            transaction.on_commit(lambda: self.schedule_advance(cycle.id))
        return self.serialize_cycle(cycle)

    @transaction.atomic
    def resolve_active_cycle(self, session, resolved_at=None):
        resolved_at = resolved_at or timezone.now()
        cycle = (
            WarningCycle.objects.select_for_update()
            .active()
            .filter(session_id=session.id)
            .order_by("-started_at")
            .first()
        )
        if cycle is None:
            return None
        cycle.status = WarningCycle.Status.RESOLVED
        cycle.resolved_at = resolved_at
        cycle.next_warning_at = None
        cycle.auto_pause_required = False
        cycle.action = WarningCycle.Action.NONE
        cycle.save()
        return self.serialize_cycle(cycle)

    def create_warning_event(self, cycle, level, session):
        auto_pause_required = (
            level >= self.max_level
            and cycle.mode == FocusSession.Mode.DEEP_WORK
        )
        warning, _ = WarningEvent.objects.get_or_create(
            warning_cycle=cycle,
            warning_level=level,
            defaults={
                "session_id": cycle.session_id,
                "browser_event": cycle.source_event,
                "warning_type": self.WARNING_TYPE_BY_MODE.get(
                    cycle.mode,
                    WarningEvent.WarningType.MANUAL,
                ),
                "decision_state": cycle.decision_state,
                "decision_source": cycle.decision_source,
                "decision_score": cycle.decision_score,
                "reason_codes": cycle.reason_codes,
                "domain": cycle.domain,
                "message": f"Warning {level}: distraction detected.",
                "auto_pause_required": auto_pause_required,
                "triggered_auto_pause": False,
            },
        )
        return warning

    def schedule_advance(self, cycle_id):
        from apps.tracking.tasks import advance_warning_cycle

        try:
            advance_warning_cycle.apply_async(
                args=[str(cycle_id)],
                countdown=self.interval_seconds,
            )
        except Exception:
            return None

    def build_idempotency_key(self, session, decision, source_event=None) -> str:
        source = str(getattr(source_event, "id", "") or "no-event")
        score = self.clamp_decision_score((decision or {}).get("decision_score"))
        return f"warning-cycle:{session.id}:{source}:{score}"

    def serialize_cycle(self, cycle) -> dict:
        return {
            "cycle_id": str(cycle.id),
            "current_level": cycle.current_level,
            "status": cycle.status,
            "decision_source": cycle.decision_source,
            "auto_pause_required": cycle.auto_pause_required,
            "action": cycle.action,
            "next_warning_at": cycle.next_warning_at,
            "started_at": cycle.started_at,
            "resolved_at": cycle.resolved_at,
        }

    @staticmethod
    def clamp_decision_score(value):
        if value is None:
            return None
        try:
            number = round(float(value))
        except (TypeError, ValueError):
            return None
        return max(0, min(100, int(number)))

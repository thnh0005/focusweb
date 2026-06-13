from dataclasses import dataclass

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .exceptions import AICircuitOpen


CIRCUIT_CLOSED = "CLOSED"
CIRCUIT_OPEN = "OPEN"
CIRCUIT_HALF_OPEN = "HALF_OPEN"


@dataclass(frozen=True)
class CircuitState:
    state: str = CIRCUIT_CLOSED
    failure_count: int = 0
    opened_at: str = ""


class AICircuitBreaker:
    def __init__(self, provider: str, operation: str):
        self.provider = provider
        self.operation = operation
        self.key = f"ai:circuit:{provider}:{operation}"
        self.failure_threshold = settings.AI_CIRCUIT_FAILURE_THRESHOLD
        self.cooldown_seconds = settings.AI_CIRCUIT_COOLDOWN_SECONDS

    def before_call(self):
        state = self.get_state()
        if state.state != CIRCUIT_OPEN:
            return state
        if self.cooldown_elapsed(state):
            half_open = CircuitState(
                state=CIRCUIT_HALF_OPEN,
                failure_count=state.failure_count,
                opened_at=state.opened_at,
            )
            self.set_state(half_open)
            return half_open
        raise AICircuitOpen(
            provider=self.provider,
            operation=self.operation,
        )

    def record_success(self):
        self.set_state(CircuitState())

    def record_failure(self):
        state = self.get_state()
        failure_count = state.failure_count + 1
        if state.state == CIRCUIT_HALF_OPEN or failure_count >= self.failure_threshold:
            self.set_state(
                CircuitState(
                    state=CIRCUIT_OPEN,
                    failure_count=failure_count,
                    opened_at=timezone.now().isoformat(),
                )
            )
        else:
            self.set_state(
                CircuitState(
                    state=CIRCUIT_CLOSED,
                    failure_count=failure_count,
                    opened_at="",
                )
            )

    def get_state(self) -> CircuitState:
        try:
            raw = cache.get(self.key) or {}
        except Exception:
            return CircuitState()
        return CircuitState(
            state=raw.get("state", CIRCUIT_CLOSED),
            failure_count=int(raw.get("failure_count", 0) or 0),
            opened_at=raw.get("opened_at", "") or "",
        )

    def set_state(self, state: CircuitState):
        try:
            cache.set(
                self.key,
                {
                    "state": state.state,
                    "failure_count": state.failure_count,
                    "opened_at": state.opened_at,
                },
                timeout=max(self.cooldown_seconds * 2, 1),
            )
        except Exception:
            return None

    def reset(self):
        try:
            cache.delete(self.key)
        except Exception:
            return None

    def cooldown_elapsed(self, state: CircuitState) -> bool:
        if not state.opened_at:
            return True
        try:
            opened_at = timezone.datetime.fromisoformat(state.opened_at)
        except ValueError:
            return True
        if timezone.is_naive(opened_at):
            opened_at = timezone.make_aware(opened_at)
        return (timezone.now() - opened_at).total_seconds() >= self.cooldown_seconds

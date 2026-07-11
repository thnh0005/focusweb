from dataclasses import dataclass
from urllib.parse import urlparse

from apps.extension.models import BlacklistEntry
from apps.sessions.models import FocusSession


RISK_LOW = "LOW"
RISK_MEDIUM = "MEDIUM"
RISK_HIGH = "HIGH"


@dataclass(frozen=True)
class BehaviorRuleConfig:
    idle_medium_seconds: int = 60
    idle_high_seconds: int = 180
    tab_switch_window_seconds: int = 60
    tab_switch_medium_count: int = 5
    tab_switch_high_count: int = 10
    blacklist_medium_score: int = 60
    blacklist_high_score: int = 90
    idle_medium_score: int = 50
    idle_high_score: int = 80
    tab_switch_medium_score: int = 45
    tab_switch_high_score: int = 75


@dataclass(frozen=True)
class BlacklistMatch:
    domain: str
    severity: str
    source: str


def normalize_rule_domain(value) -> str:
    raw_value = str(value or "").strip().lower()
    if not raw_value:
        return ""

    parsed = urlparse(raw_value if "://" in raw_value else f"https://{raw_value}")
    domain = parsed.hostname or parsed.netloc or parsed.path.split("/", maxsplit=1)[0]
    return domain.removeprefix("www.").strip(".")


def domains_match(candidate: str, protected_domain: str) -> bool:
    candidate = normalize_rule_domain(candidate)
    protected_domain = normalize_rule_domain(protected_domain)
    if not candidate or not protected_domain:
        return False
    return candidate == protected_domain or candidate.endswith(f".{protected_domain}")


def coerce_nonnegative_int(value) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return 0
    return max(0, number)


class BlacklistRepository:
    def __init__(self):
        self._entries_by_user_id = {}

    def entries_for_user(self, user):
        user_id = getattr(user, "pk", None)
        if user_id not in self._entries_by_user_id:
            self._entries_by_user_id[user_id] = list(
                BlacklistEntry.objects.available_to(user).only(
                    "domain",
                    "severity",
                    "is_default",
                )
            )
        return self._entries_by_user_id[user_id]

    def find_match(self, user, domain: str) -> BlacklistMatch | None:
        normalized_domain = normalize_rule_domain(domain)
        if not normalized_domain:
            return None

        matches = []
        for entry in self.entries_for_user(user):
            if domains_match(normalized_domain, entry.domain):
                matches.append(
                    BlacklistMatch(
                        domain=entry.domain,
                        severity=entry.severity,
                        source="default" if entry.is_default else "custom",
                    )
                )

        if not matches:
            return None

        severity_rank = {
            BlacklistEntry.Severity.MEDIUM: 1,
            BlacklistEntry.Severity.HIGH: 2,
        }
        return max(matches, key=lambda match: severity_rank.get(match.severity, 0))


class BehaviorRuleEvaluator:
    RISK_RANK = {
        RISK_LOW: 0,
        RISK_MEDIUM: 1,
        RISK_HIGH: 2,
    }

    def __init__(self, config: BehaviorRuleConfig | None = None):
        self.config = config or BehaviorRuleConfig()

    def evaluate(
        self,
        event: dict,
        blacklist_match: BlacklistMatch | None = None,
        mode: str = FocusSession.Mode.NORMAL,
    ) -> dict:
        event = event or {}
        blacklist_signal = self.evaluate_blacklist(blacklist_match)
        signals = [
            blacklist_signal,
            self.evaluate_idle(event.get("idle_seconds")),
            self.evaluate_tab_switch(event.get("tab_switch_count")),
        ]
        overall_risk = max(
            (signal["risk_level"] for signal in signals),
            key=lambda risk_level: self.RISK_RANK[risk_level],
        )
        reason_codes = [
            reason_code
            for signal in signals
            for reason_code in signal.get("reason_codes", [])
        ]
        should_warn = bool(blacklist_match and blacklist_signal["risk_level"] != RISK_LOW)

        return {
            "risk_level": overall_risk,
            "risk_score": min(100, max(signal["score"] for signal in signals)),
            "should_warn": should_warn,
            "signals": [
                {
                    "rule": signal["rule"],
                    "risk_level": signal["risk_level"],
                    "score": signal["score"],
                    "reason": signal["reason"],
                }
                for signal in signals
            ],
            "reason_codes": reason_codes,
        }

    def evaluate_blacklist(self, match: BlacklistMatch | None) -> dict:
        if match is None:
            return self.signal("blacklist", RISK_LOW, 0, "Domain is not blacklisted.")

        if match.severity == BlacklistEntry.Severity.HIGH:
            return self.signal(
                "blacklist",
                RISK_HIGH,
                self.config.blacklist_high_score,
                f"Domain matches high severity blacklist entry {match.domain}.",
                ["BLACKLIST_HIGH"],
            )

        return self.signal(
            "blacklist",
            RISK_MEDIUM,
            self.config.blacklist_medium_score,
            f"Domain matches medium severity blacklist entry {match.domain}.",
            ["BLACKLIST_MEDIUM"],
        )

    def evaluate_idle(self, idle_seconds) -> dict:
        idle_seconds = coerce_nonnegative_int(idle_seconds)
        if idle_seconds >= self.config.idle_high_seconds:
            return self.signal(
                "idle",
                RISK_HIGH,
                self.config.idle_high_score,
                f"Idle time is {idle_seconds} seconds.",
                ["IDLE_HIGH"],
            )
        if idle_seconds >= self.config.idle_medium_seconds:
            return self.signal(
                "idle",
                RISK_MEDIUM,
                self.config.idle_medium_score,
                f"Idle time is {idle_seconds} seconds.",
                ["IDLE_MEDIUM"],
            )
        return self.signal(
            "idle",
            RISK_LOW,
            0,
            f"Idle time is {idle_seconds} seconds.",
        )

    def evaluate_tab_switch(self, tab_switch_count) -> dict:
        tab_switch_count = coerce_nonnegative_int(tab_switch_count)
        if tab_switch_count >= self.config.tab_switch_high_count:
            return self.signal(
                "tab_switch",
                RISK_HIGH,
                self.config.tab_switch_high_score,
                (
                    f"Tab switch count is {tab_switch_count} in "
                    f"{self.config.tab_switch_window_seconds} seconds."
                ),
                ["TAB_SWITCH_HIGH"],
            )
        if tab_switch_count >= self.config.tab_switch_medium_count:
            return self.signal(
                "tab_switch",
                RISK_MEDIUM,
                self.config.tab_switch_medium_score,
                (
                    f"Tab switch count is {tab_switch_count} in "
                    f"{self.config.tab_switch_window_seconds} seconds."
                ),
                ["TAB_SWITCH_MEDIUM"],
            )
        return self.signal(
            "tab_switch",
            RISK_LOW,
            0,
            (
                f"Tab switch count is {tab_switch_count} in "
                f"{self.config.tab_switch_window_seconds} seconds."
            ),
        )

    @staticmethod
    def signal(
        rule: str,
        risk_level: str,
        score: int,
        reason: str,
        reason_codes: list[str] | None = None,
    ) -> dict:
        return {
            "rule": rule,
            "risk_level": risk_level,
            "score": score,
            "reason": reason,
            "reason_codes": reason_codes or [],
        }


class BehaviorRuleEngine:
    def __init__(
        self,
        repository: BlacklistRepository | None = None,
        evaluator: BehaviorRuleEvaluator | None = None,
    ):
        self.repository = repository or BlacklistRepository()
        self.evaluator = evaluator or BehaviorRuleEvaluator()

    def evaluate_event(
        self,
        user,
        event: dict,
        mode: str = FocusSession.Mode.NORMAL,
    ) -> dict:
        event = event or {}
        domain = normalize_rule_domain(event.get("domain") or event.get("url"))
        match = self.repository.find_match(user=user, domain=domain)
        result = self.evaluator.evaluate(
            event=event,
            blacklist_match=match,
            mode=mode,
        )
        result["domain"] = domain
        if match:
            result["blacklist_match"] = {
                "domain": match.domain,
                "severity": match.severity,
                "source": match.source,
            }
        else:
            result["blacklist_match"] = None
        return result

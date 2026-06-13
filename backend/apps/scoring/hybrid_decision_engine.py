from copy import deepcopy

from .decision_types import (
    DECISION_SOURCE_HYBRID,
    DECISION_SOURCE_RULE_ONLY,
    DECISION_SOURCE_RULE_ONLY_FALLBACK,
    HybridDecisionConfig,
    HybridDecisionValidationError,
    REASON_CONTENT_NOT_RELEVANT,
    REASON_CONTENT_RELEVANT,
    REASON_CONTENT_UNCERTAIN,
    REASON_SEMANTIC_UNAVAILABLE,
    RISK_HIGH,
    RISK_LOW,
    RISK_MEDIUM,
    SEMANTIC_NOT_RELEVANT,
    SEMANTIC_RELEVANT,
    SEMANTIC_UNCERTAIN,
    SESSION_MODE_DEEP_WORK,
    SESSION_MODE_NORMAL,
    STATE_DISTRACTED,
    STATE_FOCUSED,
    STATE_POTENTIALLY_DISTRACTED,
    VALID_RISK_LEVELS,
    VALID_SEMANTIC_CLASSIFICATIONS,
)


DEEP_WORK_DECISION_MATRIX = {
    (SEMANTIC_RELEVANT, RISK_LOW): STATE_FOCUSED,
    (SEMANTIC_RELEVANT, RISK_MEDIUM): STATE_POTENTIALLY_DISTRACTED,
    (SEMANTIC_RELEVANT, RISK_HIGH): STATE_POTENTIALLY_DISTRACTED,
    (SEMANTIC_UNCERTAIN, RISK_LOW): STATE_POTENTIALLY_DISTRACTED,
    (SEMANTIC_UNCERTAIN, RISK_MEDIUM): STATE_POTENTIALLY_DISTRACTED,
    (SEMANTIC_UNCERTAIN, RISK_HIGH): STATE_DISTRACTED,
    (SEMANTIC_NOT_RELEVANT, RISK_LOW): STATE_POTENTIALLY_DISTRACTED,
    (SEMANTIC_NOT_RELEVANT, RISK_MEDIUM): STATE_DISTRACTED,
    (SEMANTIC_NOT_RELEVANT, RISK_HIGH): STATE_DISTRACTED,
}

RULE_ONLY_STATE_BY_RISK = {
    RISK_LOW: STATE_FOCUSED,
    RISK_MEDIUM: STATE_POTENTIALLY_DISTRACTED,
    RISK_HIGH: STATE_DISTRACTED,
}

DEEP_WORK_SEMANTIC_UNAVAILABLE_STATE_BY_RISK = {
    RISK_LOW: STATE_FOCUSED,
    RISK_MEDIUM: STATE_POTENTIALLY_DISTRACTED,
    RISK_HIGH: STATE_POTENTIALLY_DISTRACTED,
}

SEMANTIC_REASON_BY_CLASSIFICATION = {
    SEMANTIC_RELEVANT: REASON_CONTENT_RELEVANT,
    SEMANTIC_UNCERTAIN: REASON_CONTENT_UNCERTAIN,
    SEMANTIC_NOT_RELEVANT: REASON_CONTENT_NOT_RELEVANT,
}


class HybridDecisionEngine:
    def __init__(self, config: HybridDecisionConfig | None = None):
        self.config = config or HybridDecisionConfig()

    def decide(
        self,
        rule_evaluation: dict,
        semantic_analysis: dict | None = None,
        session_mode: str = SESSION_MODE_NORMAL,
    ) -> dict:
        rule = self.normalize_rule_evaluation(rule_evaluation)
        mode = str(session_mode or "").strip().lower()
        if mode != SESSION_MODE_DEEP_WORK:
            return self.build_rule_only_decision(rule)

        semantic = self.normalize_semantic_analysis(semantic_analysis)
        if semantic is None:
            return self.build_semantic_unavailable_decision(
                rule,
                ai_error_code=self.extract_ai_error_code(semantic_analysis),
            )
        return self.build_hybrid_decision(rule, semantic)

    def build_hybrid_decision(self, rule: dict, semantic: dict) -> dict:
        state = DEEP_WORK_DECISION_MATRIX[
            (semantic["classification"], rule["risk_level"])
        ]
        semantic_distraction_score = 100 - semantic["relevance_score"]
        decision_score = self.clamp_int(
            semantic_distraction_score * self.config.semantic_weight
            + rule["risk_score"] * self.config.rule_weight,
        )
        confidence = self.clamp_float(
            semantic["confidence"] * self.config.semantic_confidence_weight
            + self.rule_confidence(rule["risk_level"])
            * self.config.rule_confidence_weight,
        )
        reason_codes = [
            *rule["reason_codes"],
            SEMANTIC_REASON_BY_CLASSIFICATION[semantic["classification"]],
        ]
        return self.build_result(
            state=state,
            decision_score=decision_score,
            confidence=confidence,
            decision_source=DECISION_SOURCE_HYBRID,
            reason_codes=reason_codes,
            rule=rule,
            semantic=semantic,
            fallback_applied=False,
            ai_error_code=None,
        )

    def build_rule_only_decision(self, rule: dict) -> dict:
        return self.build_result(
            state=RULE_ONLY_STATE_BY_RISK[rule["risk_level"]],
            decision_score=rule["risk_score"],
            confidence=self.rule_confidence(rule["risk_level"]),
            decision_source=DECISION_SOURCE_RULE_ONLY,
            reason_codes=rule["reason_codes"],
            rule=rule,
            semantic=None,
            fallback_applied=False,
            ai_error_code=None,
        )

    def build_semantic_unavailable_decision(
        self,
        rule: dict,
        ai_error_code: str | None = None,
    ) -> dict:
        return self.build_result(
            state=DEEP_WORK_SEMANTIC_UNAVAILABLE_STATE_BY_RISK[rule["risk_level"]],
            decision_score=rule["risk_score"],
            confidence=self.rule_confidence(rule["risk_level"]),
            decision_source=DECISION_SOURCE_RULE_ONLY_FALLBACK,
            reason_codes=[*rule["reason_codes"], REASON_SEMANTIC_UNAVAILABLE],
            rule=rule,
            semantic=None,
            fallback_applied=True,
            ai_error_code=ai_error_code,
        )

    def build_result(
        self,
        state: str,
        decision_score: int,
        confidence: float,
        decision_source: str,
        reason_codes: list[str],
        rule: dict,
        semantic: dict | None,
        fallback_applied: bool,
        ai_error_code: str | None,
    ) -> dict:
        return {
            "state": state,
            "decision_score": decision_score,
            "confidence": confidence,
            "decision_source": decision_source,
            "reason_codes": reason_codes,
            "contributing_signals": deepcopy(rule["signals"]),
            "rule_risk_level": rule["risk_level"],
            "semantic_classification": (
                semantic["classification"] if semantic is not None else None
            ),
            "semantic_relevance_score": (
                semantic["relevance_score"] if semantic is not None else None
            ),
            "fallback_applied": fallback_applied,
            "ai_error_code": ai_error_code,
            "should_start_warning_cycle": state == STATE_DISTRACTED,
        }

    def normalize_rule_evaluation(self, rule_evaluation: dict) -> dict:
        rule_evaluation = rule_evaluation or {}
        risk_level = str(rule_evaluation.get("risk_level") or "").strip().upper()
        if risk_level not in VALID_RISK_LEVELS:
            raise HybridDecisionValidationError(
                f"Invalid rule risk level: {risk_level or '<empty>'}."
            )

        reason_codes = rule_evaluation.get("reason_codes") or []
        if not isinstance(reason_codes, list):
            reason_codes = []
        signals = rule_evaluation.get("signals") or []
        if not isinstance(signals, list):
            signals = []

        return {
            "risk_level": risk_level,
            "risk_score": self.clamp_int(rule_evaluation.get("risk_score")),
            "reason_codes": list(reason_codes),
            "signals": deepcopy(signals),
        }

    def normalize_semantic_analysis(self, semantic_analysis: dict | None) -> dict | None:
        if not semantic_analysis:
            return None

        status = str(semantic_analysis.get("status") or "ok").strip().lower()
        available = semantic_analysis.get("available", True)
        if available is False or status not in {"ok", "existing"}:
            return None

        classification = str(
            semantic_analysis.get("classification") or ""
        ).strip().upper()
        if classification not in VALID_SEMANTIC_CLASSIFICATIONS:
            return None

        return {
            "classification": classification,
            "relevance_score": self.clamp_int(
                semantic_analysis.get("relevance_score"),
            ),
            "confidence": self.clamp_float(semantic_analysis.get("confidence")),
        }

    @staticmethod
    def extract_ai_error_code(semantic_analysis: dict | None) -> str | None:
        if not isinstance(semantic_analysis, dict):
            return None
        return semantic_analysis.get("error_code")

    def rule_confidence(self, risk_level: str) -> float:
        if risk_level == RISK_HIGH:
            return self.config.rule_high_confidence
        if risk_level == RISK_MEDIUM:
            return self.config.rule_medium_confidence
        return self.config.rule_low_confidence

    @staticmethod
    def clamp_int(value, minimum=0, maximum=100) -> int:
        try:
            number = round(float(value))
        except (TypeError, ValueError):
            number = minimum
        return int(max(minimum, min(maximum, number)))

    @staticmethod
    def clamp_float(value, minimum=0, maximum=1) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            number = minimum
        return round(max(minimum, min(maximum, number)), 4)

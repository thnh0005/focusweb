from copy import deepcopy
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from apps.ai.models import AIAnalysisResult
from apps.ai.services.ai_client import AIClient
from apps.sessions.models import FocusSession
from apps.tracking.models import BrowserEvent, WarningEvent

from .models import FocusScore, ScoreComponent
from .services import (
    DECISION_SOURCE_HYBRID,
    DECISION_SOURCE_RULE_ONLY,
    DECISION_SOURCE_RULE_ONLY_FALLBACK,
    STATE_DISTRACTED,
    STATE_FOCUSED,
    STATE_POTENTIALLY_DISTRACTED,
    HybridDecisionEngine,
    HybridDecisionValidationError,
)
from .services.score_calculator import ScoreCalculator
from .realtime_score import (
    DATA_QUALITY_INSUFFICIENT,
    DATA_QUALITY_PARTIAL,
    DATA_QUALITY_SUFFICIENT,
    LABEL_AVERAGE,
    LABEL_DEEP_FOCUS,
    LABEL_DISTRACTED,
    LABEL_FOCUSED,
    LABEL_HIGHLY_DISTRACTED,
    RealtimeScoreCalculator,
    RealtimeScoreConfig,
)


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


class ScoreCalculatorTests(TestCase):
    def setUp(self):
        self.calculator = ScoreCalculator()

    def test_weighted_formula_component_edges(self):
        keys = ScoreComponent.Key

        self.assertEqual(
            self.calculator.calculate_weighted_total(
                {
                    keys.CONTENT_RELEVANCE: 100,
                    keys.FOCUS_CONTINUITY: 100,
                    keys.TAB_STABILITY: 100,
                    keys.DISTRACTION_PENALTY: 100,
                }
            ),
            100,
        )
        self.assertEqual(
            self.calculator.calculate_weighted_total(
                {
                    keys.CONTENT_RELEVANCE: 0,
                    keys.FOCUS_CONTINUITY: 0,
                    keys.TAB_STABILITY: 0,
                    keys.DISTRACTION_PENALTY: 0,
                }
            ),
            0,
        )
        self.assertEqual(
            self.calculator.calculate_weighted_total({keys.CONTENT_RELEVANCE: 100}),
            40,
        )
        self.assertEqual(
            self.calculator.calculate_weighted_total({keys.FOCUS_CONTINUITY: 100}),
            30,
        )
        self.assertEqual(
            self.calculator.calculate_weighted_total({keys.TAB_STABILITY: 100}),
            15,
        )
        self.assertEqual(
            self.calculator.calculate_weighted_total({keys.DISTRACTION_PENALTY: 100}),
            15,
        )
        self.assertEqual(
            self.calculator.calculate_weighted_total(
                {
                    keys.CONTENT_RELEVANCE: 200,
                    keys.FOCUS_CONTINUITY: -10,
                    keys.TAB_STABILITY: 100,
                    keys.DISTRACTION_PENALTY: 100,
                }
            ),
            70,
        )

    def test_focus_state_boundaries(self):
        expectations = {
            0: FocusScore.State.HIGHLY_DISTRACTED,
            39: FocusScore.State.HIGHLY_DISTRACTED,
            40: FocusScore.State.DISTRACTED,
            59: FocusScore.State.DISTRACTED,
            60: FocusScore.State.AVERAGE,
            74: FocusScore.State.AVERAGE,
            75: FocusScore.State.FOCUSED,
            89: FocusScore.State.FOCUSED,
            90: FocusScore.State.DEEP_FOCUS,
            100: FocusScore.State.DEEP_FOCUS,
        }

        for score, expected_state in expectations.items():
            with self.subTest(score=score):
                self.assertEqual(
                    self.calculator.classify_focus_state(score),
                    expected_state,
                )

    def test_persist_final_score_is_idempotent(self):
        user = User.objects.create_user(email="score@example.com", password=PASSWORD)
        session = FocusSession.objects.create(
            user=user,
            mode=FocusSession.Mode.NORMAL,
            status=FocusSession.Status.COMPLETED,
            target_duration_seconds=100,
            actual_duration_seconds=100,
        )

        first = self.calculator.persist_final_score(session)
        second = self.calculator.persist_final_score(session)
        session.refresh_from_db()

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(FocusScore.objects.filter(session=session).count(), 1)
        self.assertEqual(first.components.count(), 4)
        self.assertEqual(session.focus_score, 100)
        self.assertEqual(session.focus_state, FocusScore.State.DEEP_FOCUS)

    def test_final_score_without_tracking_uses_duration_fallback(self):
        user = User.objects.create_user(email="fallback@example.com", password=PASSWORD)
        session = FocusSession.objects.create(
            user=user,
            mode=FocusSession.Mode.NORMAL,
            status=FocusSession.Status.COMPLETED,
            target_duration_seconds=100,
            actual_duration_seconds=50,
        )

        result = self.calculator.calculate_final_score(session)

        self.assertEqual(result["metadata"]["source"], "duration_fallback")
        self.assertFalse(result["metadata"]["hasTrackingSignals"])
        self.assertEqual(
            result["components"][ScoreComponent.Key.FOCUS_CONTINUITY],
            50,
        )

    def test_final_score_uses_browser_events_for_light_distraction(self):
        user = User.objects.create_user(email="browser-score@example.com", password=PASSWORD)
        session = FocusSession.objects.create(
            user=user,
            mode=FocusSession.Mode.NORMAL,
            status=FocusSession.Status.COMPLETED,
            target_duration_seconds=300,
            actual_duration_seconds=300,
        )
        for _ in range(3):
            BrowserEvent.objects.create(
                session_id=session.id,
                event_type="url_change",
                domain="docs.example.com",
                active_seconds=60,
                idle_seconds=0,
                tab_switch_count=1,
            )

        result = self.calculator.calculate_final_score(session)

        self.assertEqual(result["metadata"]["source"], "tracking_signals")
        self.assertTrue(result["metadata"]["hasBrowserEvents"])
        self.assertLess(result["components"][ScoreComponent.Key.TAB_STABILITY], 100)
        self.assertLess(result["total"], 100)

    def test_final_score_many_warnings_reduce_score_clearly(self):
        user = User.objects.create_user(email="warning-score@example.com", password=PASSWORD)
        session = FocusSession.objects.create(
            user=user,
            mode=FocusSession.Mode.NORMAL,
            status=FocusSession.Status.COMPLETED,
            target_duration_seconds=300,
            actual_duration_seconds=300,
        )
        for _ in range(3):
            WarningEvent.objects.create(
                session_id=session.id,
                warning_level=3,
                warning_type=WarningEvent.WarningType.DEEP_WORK_AI,
                decision_state="DISTRACTED",
                decision_source="HYBRID",
                decision_score=90,
                domain="video.example.com",
            )

        result = self.calculator.calculate_final_score(session)

        self.assertEqual(result["metadata"]["source"], "tracking_signals")
        self.assertTrue(result["metadata"]["hasWarningEvents"])
        self.assertLess(
            result["components"][ScoreComponent.Key.DISTRACTION_PENALTY],
            60,
        )
        self.assertLess(result["total"], 95)

    def test_final_score_uses_semantic_relevance_when_available(self):
        user = User.objects.create_user(email="semantic-score@example.com", password=PASSWORD)
        session = FocusSession.objects.create(
            user=user,
            mode=FocusSession.Mode.DEEP_WORK,
            status=FocusSession.Status.COMPLETED,
            target_duration_seconds=300,
            actual_duration_seconds=300,
        )
        AIAnalysisResult.objects.create(
            session_id=session.id,
            provider="test",
            model_name="semantic-test",
            relevance_score=35,
            is_relevant=False,
            focus_state=AIAnalysisResult.FocusState.DISTRACTED,
        )

        result = self.calculator.calculate_final_score(session)

        self.assertTrue(result["metadata"]["hasSemanticAi"])
        self.assertEqual(
            result["components"][ScoreComponent.Key.CONTENT_RELEVANCE],
            35,
        )

    def test_database_rejects_out_of_range_scores_and_components(self):
        user = User.objects.create_user(email="constraints@example.com", password=PASSWORD)
        session = FocusSession.objects.create(
            user=user,
            mode=FocusSession.Mode.NORMAL,
            status=FocusSession.Status.COMPLETED,
            target_duration_seconds=100,
            actual_duration_seconds=100,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                FocusScore.objects.create(
                    user=user,
                    session=session,
                    total_score=101,
                    focus_state=FocusScore.State.DEEP_FOCUS,
                )

        score = FocusScore.objects.create(
            user=user,
            session=session,
            total_score=100,
            focus_state=FocusScore.State.DEEP_FOCUS,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ScoreComponent.objects.create(
                    score=score,
                    key=ScoreComponent.Key.CONTENT_RELEVANCE,
                    label="Content relevance",
                    value=101,
                    weight=0.40,
                )


class HybridDecisionEngineTests(TestCase):
    def setUp(self):
        self.engine = HybridDecisionEngine()

    def rule(self, risk_level="LOW", risk_score=0, reason_codes=None, signals=None):
        return {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "reason_codes": reason_codes or [],
            "signals": signals or [],
        }

    def semantic(
        self,
        classification="RELEVANT",
        relevance_score=85,
        confidence=0.9,
        status="ok",
    ):
        return {
            "status": status,
            "classification": classification,
            "relevance_score": relevance_score,
            "confidence": confidence,
        }

    def assert_decision(
        self,
        semantic_classification,
        rule_risk,
        expected_state,
        relevance_score=85,
        rule_score=0,
    ):
        result = self.engine.decide(
            rule_evaluation=self.rule(rule_risk, rule_score),
            semantic_analysis=self.semantic(
                classification=semantic_classification,
                relevance_score=relevance_score,
            ),
            session_mode=FocusSession.Mode.DEEP_WORK,
        )

        self.assertEqual(result["state"], expected_state)
        self.assertEqual(result["decision_source"], DECISION_SOURCE_HYBRID)
        self.assertEqual(result["semantic_classification"], semantic_classification)

    def test_deep_work_decision_matrix(self):
        cases = [
            ("RELEVANT", "LOW", STATE_FOCUSED),
            ("RELEVANT", "MEDIUM", STATE_POTENTIALLY_DISTRACTED),
            ("RELEVANT", "HIGH", STATE_POTENTIALLY_DISTRACTED),
            ("UNCERTAIN", "LOW", STATE_POTENTIALLY_DISTRACTED),
            ("UNCERTAIN", "MEDIUM", STATE_POTENTIALLY_DISTRACTED),
            ("UNCERTAIN", "HIGH", STATE_DISTRACTED),
            ("NOT_RELEVANT", "LOW", STATE_POTENTIALLY_DISTRACTED),
            ("NOT_RELEVANT", "MEDIUM", STATE_DISTRACTED),
            ("NOT_RELEVANT", "HIGH", STATE_DISTRACTED),
        ]

        for semantic_classification, rule_risk, expected_state in cases:
            with self.subTest(
                semantic_classification=semantic_classification,
                rule_risk=rule_risk,
            ):
                self.assert_decision(
                    semantic_classification,
                    rule_risk,
                    expected_state,
                )

    def test_high_blacklist_relevant_is_not_distracted(self):
        result = self.engine.decide(
            rule_evaluation=self.rule(
                "HIGH",
                90,
                ["BLACKLIST_HIGH"],
                [{"rule": "blacklist", "risk_level": "HIGH"}],
            ),
            semantic_analysis=self.semantic("RELEVANT", 92),
            session_mode=FocusSession.Mode.DEEP_WORK,
        )

        self.assertEqual(result["state"], STATE_POTENTIALLY_DISTRACTED)
        self.assertFalse(result["should_start_warning_cycle"])
        self.assertIn("BLACKLIST_HIGH", result["reason_codes"])

    def test_high_blacklist_not_relevant_is_distracted(self):
        result = self.engine.decide(
            rule_evaluation=self.rule(
                "HIGH",
                90,
                ["BLACKLIST_HIGH"],
                [{"rule": "blacklist", "risk_level": "HIGH"}],
            ),
            semantic_analysis=self.semantic("NOT_RELEVANT", 20),
            session_mode=FocusSession.Mode.DEEP_WORK,
        )

        self.assertEqual(result["state"], STATE_DISTRACTED)
        self.assertTrue(result["should_start_warning_cycle"])

    def test_normal_mode_rule_only_mapping(self):
        cases = [
            ("LOW", STATE_FOCUSED),
            ("MEDIUM", STATE_POTENTIALLY_DISTRACTED),
            ("HIGH", STATE_DISTRACTED),
        ]

        for risk_level, expected_state in cases:
            with self.subTest(risk_level=risk_level):
                result = self.engine.decide(
                    rule_evaluation=self.rule(risk_level, 70),
                    semantic_analysis=self.semantic("NOT_RELEVANT", 0),
                    session_mode=FocusSession.Mode.NORMAL,
                )

                self.assertEqual(result["state"], expected_state)
                self.assertEqual(result["decision_source"], DECISION_SOURCE_RULE_ONLY)
                self.assertIsNone(result["semantic_classification"])
                self.assertIsNone(result["semantic_relevance_score"])

    def test_deep_work_semantic_none_rule_only_fallback(self):
        cases = [
            ("LOW", STATE_FOCUSED),
            ("MEDIUM", STATE_POTENTIALLY_DISTRACTED),
            ("HIGH", STATE_POTENTIALLY_DISTRACTED),
        ]

        for risk_level, expected_state in cases:
            with self.subTest(risk_level=risk_level):
                result = self.engine.decide(
                    rule_evaluation=self.rule(risk_level, 90),
                    semantic_analysis=None,
                    session_mode=FocusSession.Mode.DEEP_WORK,
                )

                self.assertEqual(result["state"], expected_state)
                self.assertEqual(
                    result["decision_source"],
                    DECISION_SOURCE_RULE_ONLY_FALLBACK,
                )
                self.assertTrue(result["fallback_applied"])
                self.assertIn("SEMANTIC_UNAVAILABLE", result["reason_codes"])

    def test_semantic_unavailable_status_does_not_auto_distract(self):
        result = self.engine.decide(
            rule_evaluation=self.rule("HIGH", 90),
            semantic_analysis={"status": "error", "error_code": "AI_TIMEOUT"},
            session_mode=FocusSession.Mode.DEEP_WORK,
        )

        self.assertEqual(result["state"], STATE_POTENTIALLY_DISTRACTED)
        self.assertFalse(result["should_start_warning_cycle"])
        self.assertEqual(result["decision_source"], DECISION_SOURCE_RULE_ONLY_FALLBACK)
        self.assertTrue(result["fallback_applied"])
        self.assertEqual(result["ai_error_code"], "AI_TIMEOUT")
        self.assertIn("SEMANTIC_UNAVAILABLE", result["reason_codes"])

    def test_score_and_confidence_are_bounded(self):
        result = self.engine.decide(
            rule_evaluation=self.rule("HIGH", 200),
            semantic_analysis=self.semantic(
                classification="NOT_RELEVANT",
                relevance_score=-20,
                confidence=3,
            ),
            session_mode=FocusSession.Mode.DEEP_WORK,
        )

        self.assertGreaterEqual(result["decision_score"], 0)
        self.assertLessEqual(result["decision_score"], 100)
        self.assertGreaterEqual(result["confidence"], 0)
        self.assertLessEqual(result["confidence"], 1)
        self.assertEqual(result["semantic_relevance_score"], 0)

    def test_reason_codes_are_preserved_and_semantic_code_is_added(self):
        result = self.engine.decide(
            rule_evaluation=self.rule(
                "MEDIUM",
                60,
                ["BLACKLIST_MEDIUM", "TAB_SWITCH_MEDIUM"],
            ),
            semantic_analysis=self.semantic("UNCERTAIN", 55),
            session_mode=FocusSession.Mode.DEEP_WORK,
        )

        self.assertEqual(
            result["reason_codes"],
            ["BLACKLIST_MEDIUM", "TAB_SWITCH_MEDIUM", "CONTENT_UNCERTAIN"],
        )

    def test_semantic_reason_codes_by_classification(self):
        cases = [
            ("RELEVANT", "CONTENT_RELEVANT"),
            ("UNCERTAIN", "CONTENT_UNCERTAIN"),
            ("NOT_RELEVANT", "CONTENT_NOT_RELEVANT"),
        ]

        for classification, expected_reason in cases:
            with self.subTest(classification=classification):
                result = self.engine.decide(
                    rule_evaluation=self.rule("LOW", 0),
                    semantic_analysis=self.semantic(classification),
                    session_mode=FocusSession.Mode.DEEP_WORK,
                )

                self.assertIn(expected_reason, result["reason_codes"])

    def test_warning_cycle_signal_only_for_distracted(self):
        distracted = self.engine.decide(
            self.rule("HIGH", 90),
            self.semantic("NOT_RELEVANT", 20),
            FocusSession.Mode.DEEP_WORK,
        )
        focused = self.engine.decide(
            self.rule("LOW", 0),
            self.semantic("RELEVANT", 90),
            FocusSession.Mode.DEEP_WORK,
        )
        potential = self.engine.decide(
            self.rule("MEDIUM", 60),
            self.semantic("RELEVANT", 90),
            FocusSession.Mode.DEEP_WORK,
        )

        self.assertTrue(distracted["should_start_warning_cycle"])
        self.assertFalse(focused["should_start_warning_cycle"])
        self.assertFalse(potential["should_start_warning_cycle"])

    def test_engine_does_not_call_ai_client(self):
        with patch.object(AIClient, "complete_json") as complete_json:
            self.engine.decide(
                self.rule("LOW", 0),
                self.semantic("RELEVANT", 90),
                FocusSession.Mode.DEEP_WORK,
            )

        complete_json.assert_not_called()

    def test_engine_does_not_query_database(self):
        with CaptureQueriesContext(connection) as queries:
            self.engine.decide(
                self.rule("LOW", 0),
                self.semantic("RELEVANT", 90),
                FocusSession.Mode.DEEP_WORK,
            )

        self.assertEqual(len(queries), 0)

    def test_engine_does_not_create_warning_or_change_session(self):
        user = User.objects.create_user(email="hybrid@example.com", password=PASSWORD)
        session = FocusSession.objects.create(
            user=user,
            mode=FocusSession.Mode.DEEP_WORK,
            goal="Study APIs",
            status=FocusSession.Status.ACTIVE,
            target_duration_seconds=3000,
        )
        before_status = session.status

        self.engine.decide(
            self.rule("HIGH", 90),
            self.semantic("NOT_RELEVANT", 10),
            FocusSession.Mode.DEEP_WORK,
        )
        session.refresh_from_db()

        self.assertEqual(session.status, before_status)
        self.assertFalse(WarningEvent.objects.exists())

    def test_same_input_returns_same_output(self):
        rule = self.rule("MEDIUM", 60, ["TAB_SWITCH_MEDIUM"])
        semantic = self.semantic("UNCERTAIN", 50, 0.5)

        first = self.engine.decide(rule, semantic, FocusSession.Mode.DEEP_WORK)
        second = self.engine.decide(rule, semantic, FocusSession.Mode.DEEP_WORK)

        self.assertEqual(first, second)

    def test_engine_does_not_mutate_input_objects(self):
        rule = self.rule(
            "MEDIUM",
            60,
            ["TAB_SWITCH_MEDIUM"],
            [{"rule": "tab_switch", "risk_level": "MEDIUM"}],
        )
        semantic = self.semantic("UNCERTAIN", 50, 0.5)
        original_rule = deepcopy(rule)
        original_semantic = deepcopy(semantic)

        self.engine.decide(rule, semantic, FocusSession.Mode.DEEP_WORK)

        self.assertEqual(rule, original_rule)
        self.assertEqual(semantic, original_semantic)

    def test_invalid_risk_enum_is_reported_clearly(self):
        with self.assertRaises(HybridDecisionValidationError) as error:
            self.engine.decide(
                self.rule("CRITICAL", 100),
                self.semantic("RELEVANT", 90),
                FocusSession.Mode.DEEP_WORK,
            )

        self.assertIn("Invalid rule risk level", str(error.exception))

    def test_invalid_semantic_enum_degrades_to_rule_fallback(self):
        result = self.engine.decide(
            self.rule("LOW", 0),
            self.semantic("VERY_RELEVANT", 90),
            FocusSession.Mode.DEEP_WORK,
        )

        self.assertEqual(result["state"], STATE_FOCUSED)
        self.assertEqual(result["decision_source"], DECISION_SOURCE_RULE_ONLY_FALLBACK)
        self.assertTrue(result["fallback_applied"])


class RealtimeScoreCalculatorTests(TestCase):
    def setUp(self):
        self.calculator = RealtimeScoreCalculator(
            RealtimeScoreConfig(min_events=3, tab_switch_penalty=10)
        )

    def event(self, active_seconds=10, idle_seconds=0, tab_switch_count=0):
        return {
            "active_seconds": active_seconds,
            "idle_seconds": idle_seconds,
            "tab_switch_count": tab_switch_count,
        }

    def test_no_event_returns_null_score_and_insufficient(self):
        result = self.calculator.calculate(events=[])

        self.assertIsNone(result["score"])
        self.assertIsNone(result["label"])
        self.assertEqual(result["data_quality"], DATA_QUALITY_INSUFFICIENT)
        self.assertEqual(result["event_count"], 0)
        self.assertTrue(all(value is None for value in result["components"].values()))

    def test_events_under_minimum_are_insufficient(self):
        result = self.calculator.calculate(
            events=[self.event(), self.event()],
            relevance_scores=[80],
            decision_states=["FOCUSED"],
        )

        self.assertIsNone(result["score"])
        self.assertEqual(result["data_quality"], DATA_QUALITY_INSUFFICIENT)

    def test_enough_events_calculates_score(self):
        result = self.calculator.calculate(
            events=[self.event(), self.event(), self.event()],
            relevance_scores=[80, 90],
            decision_states=["FOCUSED", "POTENTIALLY_DISTRACTED"],
        )

        self.assertIsInstance(result["score"], int)
        self.assertEqual(result["data_quality"], DATA_QUALITY_SUFFICIENT)

    def test_score_and_components_are_bounded_or_null(self):
        result = self.calculator.calculate(
            events=[
                self.event(active_seconds=0, idle_seconds=999, tab_switch_count=999),
                self.event(active_seconds=-1, idle_seconds=-1, tab_switch_count=-1),
                self.event(active_seconds=1, idle_seconds=1, tab_switch_count=1),
            ],
            relevance_scores=[120, -10],
            decision_states=["DISTRACTED"],
        )

        self.assertGreaterEqual(result["score"], 0)
        self.assertLessEqual(result["score"], 100)
        for component in result["components"].values():
            if component is not None:
                self.assertGreaterEqual(component, 0)
                self.assertLessEqual(component, 100)

    def test_score_label_boundaries(self):
        expectations = {
            90: LABEL_DEEP_FOCUS,
            89: LABEL_FOCUSED,
            75: LABEL_FOCUSED,
            74: LABEL_AVERAGE,
            60: LABEL_AVERAGE,
            59: LABEL_DISTRACTED,
            40: LABEL_DISTRACTED,
            39: LABEL_HIGHLY_DISTRACTED,
        }

        for score, label in expectations.items():
            with self.subTest(score=score):
                self.assertEqual(RealtimeScoreCalculator.label_for_score(score), label)

    def test_ai_relevance_average_and_clamp(self):
        result = self.calculator.calculate(
            events=[self.event(), self.event(), self.event()],
            relevance_scores=[120, 80, -5],
            decision_states=["FOCUSED"],
        )

        self.assertEqual(result["components"]["content_relevance"], 60)

    def test_normal_mode_does_not_require_ai_result(self):
        result = self.calculator.calculate(
            events=[self.event(), self.event(), self.event()],
            relevance_scores=[],
            decision_states=["FOCUSED"],
        )

        self.assertIsNotNone(result["score"])
        self.assertIsNone(result["components"]["content_relevance"])
        self.assertEqual(result["data_quality"], DATA_QUALITY_PARTIAL)

    def test_tab_switches_increasing_do_not_increase_tab_stability(self):
        low_switch = self.calculator.calculate_tab_stability(
            [self.event(tab_switch_count=1)]
        )
        high_switch = self.calculator.calculate_tab_stability(
            [self.event(tab_switch_count=5)]
        )

        self.assertLessEqual(high_switch, low_switch)

    def test_idle_increasing_does_not_increase_focus_continuity(self):
        low_idle = self.calculator.calculate_focus_continuity(
            [self.event(active_seconds=100, idle_seconds=10)]
        )
        high_idle = self.calculator.calculate_focus_continuity(
            [self.event(active_seconds=100, idle_seconds=50)]
        )

        self.assertLessEqual(high_idle, low_idle)

    def test_distracted_decisions_reduce_distraction_control(self):
        focused = self.calculator.calculate_distraction_control(["FOCUSED"])
        distracted = self.calculator.calculate_distraction_control(["DISTRACTED"])

        self.assertLess(distracted, focused)

    def test_none_and_malformed_metrics_are_safe(self):
        result = self.calculator.calculate(
            events=[
                self.event(active_seconds=None, idle_seconds="bad", tab_switch_count=None),
                self.event(active_seconds=-1, idle_seconds=-2, tab_switch_count=-3),
                self.event(active_seconds=0, idle_seconds=0, tab_switch_count=0),
            ]
        )

        self.assertIsNone(result["components"]["focus_continuity"])
        self.assertEqual(result["components"]["tab_stability"], 100)

    def test_cumulative_counters_are_not_summed_as_snapshots(self):
        events = [
            self.event(active_seconds=10, idle_seconds=1, tab_switch_count=1),
            self.event(active_seconds=20, idle_seconds=2, tab_switch_count=2),
            self.event(active_seconds=30, idle_seconds=3, tab_switch_count=3),
        ]

        self.assertEqual(self.calculator.aggregate_counter(events, "tab_switch_count"), 2)
        self.assertEqual(self.calculator.calculate_tab_stability(events), 80)

    def test_missing_component_policy_uses_available_weights(self):
        result = self.calculator.calculate(
            events=[self.event(), self.event(), self.event()],
            ai_status="DEGRADED",
            ai_error_code="AI_UNAVAILABLE",
        )

        self.assertIsNotNone(result["score"])
        self.assertEqual(result["data_quality"], DATA_QUALITY_PARTIAL)
        self.assertIsNone(result["components"]["content_relevance"])
        self.assertIsNone(result["components"]["distraction_control"])
        self.assertEqual(result["ai_status"], "DEGRADED")
        self.assertEqual(result["ai_error_code"], "AI_UNAVAILABLE")

    def test_calculator_is_deterministic_and_does_not_mutate_input(self):
        events = [self.event(), self.event(idle_seconds=10), self.event()]
        relevance_scores = [90, 80]
        decision_states = ["FOCUSED"]
        original_events = deepcopy(events)

        first = self.calculator.calculate(events, relevance_scores, decision_states)
        second = self.calculator.calculate(events, relevance_scores, decision_states)

        self.assertEqual(first, second)
        self.assertEqual(events, original_events)

    def test_calculator_does_not_query_database_or_call_ai(self):
        with CaptureQueriesContext(connection) as queries:
            with patch.object(AIClient, "complete_json") as complete_json:
                self.calculator.calculate(
                    events=[self.event(), self.event(), self.event()],
                    relevance_scores=[90],
                    decision_states=["FOCUSED"],
                )

        self.assertEqual(len(queries), 0)
        complete_json.assert_not_called()

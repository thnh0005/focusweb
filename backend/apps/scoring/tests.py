from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.sessions.models import FocusSession

from .models import FocusScore, ScoreComponent
from .services.score_calculator import ScoreCalculator


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

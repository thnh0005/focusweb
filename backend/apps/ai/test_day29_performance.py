from io import BytesIO
from unittest.mock import patch
from urllib.error import HTTPError

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext

from apps.ai.models import AIAnalysisResult
from apps.ai.services import AIRateLimited, AIProviderError
from apps.ai.services.ai_client import AIClient
from apps.analytics.tasks import generate_study_report_export_task
from apps.extension.models import BlacklistEntry
from apps.notifications.tasks import generate_notification_for_user
from apps.scoring.realtime_score_service import RealtimeScoreService
from apps.sessions.models import FocusSession
from apps.tracking.models import BrowserEvent
from apps.tracking.services.behavior_rule_engine import BehaviorRuleEngine
from apps.users.tasks import generate_account_data_export_task, delete_account_data_task


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


def http_error(status_code):
    return HTTPError(
        "https://openrouter.test/chat/completions",
        status_code,
        "error",
        {},
        BytesIO(b'{"error":"safe"}'),
    )


@override_settings(
    OPENROUTER_API_KEY="test-api-key",
    OPENROUTER_MODEL="test-model",
    AI_RETRY_BACKOFF_SECONDS=0,
    REALTIME_SCORE_MIN_EVENTS=1,
)
class Dev2Day29PerformanceHardeningTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="day29@example.com",
            password=PASSWORD,
        )

    def create_session(self):
        return FocusSession.objects.create(
            user=self.user,
            mode=FocusSession.Mode.DEEP_WORK,
            goal="Measure Day 29 performance",
            status=FocusSession.Status.ACTIVE,
            target_duration_seconds=1800,
        )

    def test_rule_engine_reuses_blacklist_query_across_many_events(self):
        BlacklistEntry.objects.create(
            user=self.user,
            domain="youtube.com",
            severity=BlacklistEntry.Severity.HIGH,
        )
        engine = BehaviorRuleEngine()

        with CaptureQueriesContext(connection) as captured:
            for index in range(50):
                result = engine.evaluate_event(
                    user=self.user,
                    event={
                        "event_type": "url_change",
                        "domain": f"docs{index}.example.com",
                        "idle_seconds": 0,
                        "tab_switch_count": 0,
                    },
                    mode=FocusSession.Mode.DEEP_WORK,
                )
                self.assertEqual(result["risk_level"], "LOW")

        blacklist_queries = [
            query
            for query in captured.captured_queries
            if "extension_blacklistentry" in query["sql"].lower()
        ]
        self.assertEqual(len(blacklist_queries), 1)

    def test_realtime_score_uses_bounded_query_count_for_many_events(self):
        session = self.create_session()
        events = BrowserEvent.objects.bulk_create(
            [
                BrowserEvent(
                    session_id=session.id,
                    event_type="url_change",
                    domain="docs.djangoproject.com",
                    active_seconds=30,
                    idle_seconds=0,
                    tab_switch_count=index % 3,
                )
                for index in range(50)
            ]
        )
        AIAnalysisResult.objects.bulk_create(
            [
                AIAnalysisResult(
                    session_id=session.id,
                    browser_event_id=event.id,
                    relevance_score=90,
                    is_relevant=True,
                    focus_state=AIAnalysisResult.FocusState.FOCUSED,
                )
                for event in events
            ]
        )

        with CaptureQueriesContext(connection) as captured:
            result = RealtimeScoreService().calculate_for_session(session)

        self.assertGreaterEqual(result["score"], 0)
        self.assertLessEqual(result["score"], 100)
        self.assertLessEqual(len(captured.captured_queries), 2)

    def test_ai_client_retries_retryable_statuses_but_not_business_errors(self):
        retry_client = AIClient(max_retries=1, retry_backoff_seconds=0)
        with self.assertRaises(AIRateLimited):
            with self.settings(AI_RETRY_BACKOFF_SECONDS=0):
                with patch(
                    "apps.ai.services.ai_client.urlopen",
                    side_effect=[http_error(429), http_error(429)],
                ) as calls:
                    retry_client.post_json("/chat/completions", {}, operation="day29")
        self.assertEqual(calls.call_count, 2)

        business_client = AIClient(max_retries=3, retry_backoff_seconds=0)
        with self.assertRaises(AIProviderError) as error:
            with patch(
                "apps.ai.services.ai_client.urlopen",
                side_effect=[http_error(400)],
            ) as calls:
                business_client.post_json("/chat/completions", {}, operation="day29")
        self.assertFalse(error.exception.retryable)
        self.assertEqual(calls.call_count, 1)

    def test_missing_worker_records_return_non_retryable_skips(self):
        missing_id = "00000000-0000-0000-0000-000000000000"

        notification_result = generate_notification_for_user.run(
            missing_id,
            "session_reminder",
        )
        report_result = generate_study_report_export_task.run(missing_id)
        account_export_result = generate_account_data_export_task.run(missing_id)
        account_delete_result = delete_account_data_task.run(missing_id)

        self.assertEqual(notification_result["status"], "skipped")
        self.assertEqual(notification_result["error_code"], "USER_NOT_FOUND")
        self.assertEqual(report_result["status"], "skipped")
        self.assertFalse(report_result["retryable"])
        self.assertEqual(account_export_result["status"], "skipped")
        self.assertFalse(account_export_result["retryable"])
        self.assertEqual(account_delete_result["status"], "skipped")
        self.assertFalse(account_delete_result["retryable"])

    def test_invalid_notification_type_fails_without_exception(self):
        result = generate_notification_for_user.run(self.user.id, "unknown")

        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error_code"], "INVALID_NOTIFICATION_TYPE")

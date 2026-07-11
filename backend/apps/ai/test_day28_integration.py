import inspect
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.ai.models import (
    AIAnalysisResult,
    DocumentSummary,
    Flashcard,
    FlashcardDeck,
    StudyDocument,
)
from apps.ai.services import AIProviderError
from apps.ai.services.ai_client import AIClient
from apps.ai.services.document_extraction import DocumentExtractionService
from apps.ai.tasks import (
    extract_document_text,
    generate_document_flashcards,
    generate_document_summary,
    generate_session_insight,
)
from apps.extension.models import BlacklistEntry, ExtensionHeartbeat
from apps.sessions.models import FocusSession
from apps.tracking.models import BrowserEvent, EventBatch, WarningCycle, WarningEvent
from apps.tracking.services.warning_cycle_service import WarningCycleService


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


def semantic_response(score=15, classification="NOT_RELEVANT", reason="Not aligned."):
    return {
        "content": (
            f'{{"relevance_score": {score}, '
            f'"classification": "{classification}", '
            f'"confidence": 0.94, "reason": "{reason}"}}'
        ),
        "source": "openrouter",
        "model": "semantic-test",
        "latency_ms": 8,
    }


def detailed_summary_response():
    return {
        "content": (
            '{"language":"en","title":"FocusOS Study Notes",'
            '"overview":"FocusOS study notes explain goals, review, and fewer distractions.",'
            '"sections":[{"heading":"Goals","content":"Clear goals improve FocusOS study sessions."}],'
            '"conclusion":"Review extracted study material regularly."}'
        ),
        "source": "openrouter",
        "model": "summary-test",
        "latency_ms": 11,
    }


def flashcard_response():
    return {
        "content": (
            '{"language":"en","difficulty":"medium","flashcards":['
            '{"question":"What improves FocusOS study sessions?",'
            '"answer":"Clear goals improve FocusOS study sessions."},'
            '{"question":"What should students review?",'
            '"answer":"Students should review extracted study material."}'
            '],"warnings":[]}'
        ),
        "source": "openrouter",
        "model": "flashcard-test",
        "latency_ms": 10,
    }


def duplicate_flashcard_response():
    return {
        "content": (
            '{"language":"en","difficulty":"medium","flashcards":['
            '{"question":"What improves FocusOS study sessions?",'
            '"answer":"Clear goals improve FocusOS study sessions."},'
            '{"question":"  what improves focusos study sessions?  ",'
            '"answer":"Clear goals improve FocusOS study sessions."},'
            '{"question":"What improves FocusOS study sessions?",'
            '"answer":"Clear goals improve FocusOS study sessions."},'
            '{"question":"Which answer is empty?","answer":""}'
            '],"warnings":[]}'
        ),
        "source": "openrouter",
        "model": "flashcard-test",
        "latency_ms": 10,
    }


@override_settings(
    OPENROUTER_API_KEY="test-api-key",
    OPENROUTER_MODEL="test-model",
    DOCUMENT_SUMMARY_MODEL="summary-model",
    FLASHCARD_GENERATION_MODEL="flashcard-model",
    REALTIME_SCORE_MIN_EVENTS=1,
    WARNING_INTERVAL_SECONDS=1,
    WARNING_MAX_LEVEL=3,
)
class Dev2Day28IntegrationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="day28@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="day28-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def test_extension_tracking_semantic_warning_autopause_score_flow(self):
        session_response = self.client.post(
            "/api/sessions/",
            {
                "mode": "deep-work",
                "goal": "Study Django REST Framework serializers",
                "targetDurationSeconds": 3000,
                "tags": ["Backend", "AI"],
            },
            format="json",
        )
        self.assertEqual(session_response.status_code, status.HTTP_201_CREATED)
        session = FocusSession.objects.get(pk=session_response.data["id"])

        heartbeat = self.client.post(
            "/api/extension/heartbeat/",
            {"extension_version": "1.2.3", "browser": "chrome"},
            format="json",
        )
        self.assertEqual(heartbeat.status_code, status.HTTP_200_OK)
        self.assertTrue(heartbeat.data["connected"])
        self.assertEqual(ExtensionHeartbeat.objects.filter(user_id=self.user.id).count(), 1)

        active = self.client.get("/api/extension/active-session/")
        self.assertEqual(active.status_code, status.HTTP_200_OK)
        self.assertTrue(active.data["has_active_session"])
        self.assertEqual(str(active.data["session"]["id"]), str(session.id))
        self.assertNotIn("content_snippet", str(active.data))

        self.client.force_authenticate(self.other_user)
        other_active = self.client.get("/api/extension/active-session/")
        self.assertEqual(other_active.status_code, status.HTTP_200_OK)
        self.assertFalse(other_active.data["has_active_session"])
        other_event = self.client.post(
            f"/api/sessions/{session.id}/events/batch/",
            {
                "events": [
                    {
                        "event_type": "url_change",
                        "url": "https://docs.djangoproject.com/",
                        "domain": "docs.djangoproject.com",
                        "page_title": "Cross-owner attempt",
                    }
                ]
            },
            format="json",
        )
        self.assertEqual(other_event.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(BrowserEvent.objects.filter(session_id=session.id).count(), 0)
        self.client.force_authenticate(self.user)

        with patch.object(
            AIClient,
            "complete_json",
            return_value=semantic_response(
                score=88,
                classification="RELEVANT",
                reason="Serializer docs match the goal.",
            ),
        ) as complete_json:
            focused = self.client.post(
                f"/api/sessions/{session.id}/events/batch/",
                {
                    "events": [
                        {
                            "event_type": "url_change",
                            "url": "https://www.django-rest-framework.org/api-guide/serializers/",
                            "domain": "www.django-rest-framework.org",
                            "page_title": "Serializers - Django REST framework",
                            "meta_description": "Serializer documentation",
                            "content_snippet": "Serializers convert complex data types.",
                            "active_seconds": 45,
                            "idle_seconds": 0,
                            "tab_switch_count": 1,
                        }
                    ]
                },
                format="json",
            )
        self.assertEqual(focused.status_code, status.HTTP_200_OK)
        self.assertEqual(focused.data["accepted_count"], 1)
        self.assertEqual(focused.data["ai"]["status"], "DISABLED")
        self.assertEqual(
            focused.data["hybrid_decisions"][0]["result"]["state"],
            "FOCUSED",
        )
        complete_json.assert_not_called()
        self.assertEqual(AIAnalysisResult.objects.filter(session_id=session.id).count(), 0)
        self.assertFalse(WarningCycle.objects.exists())

        BlacklistEntry.objects.create(
            user=self.user,
            domain="youtube.com",
            severity=BlacklistEntry.Severity.HIGH,
        )

        with patch.object(AIClient, "complete_json") as complete_json:
            with patch.object(WarningCycleService, "schedule_advance"):
                distracted = self.client.post(
                    f"/api/sessions/{session.id}/events/batch/",
                    {
                        "events": [
                            {
                                "event_type": "url_change",
                                "url": "https://www.youtube.com/watch?v=abc",
                                "domain": "www.youtube.com",
                                "page_title": "Unrelated video",
                                "meta_description": "Entertainment",
                                "content_snippet": "Entertainment video unrelated to work.",
                                "active_seconds": 10,
                                "idle_seconds": 25,
                                "tab_switch_count": 8,
                            },
                            {
                                "event_type": "url_change",
                                "url": "https://www.youtube.com/watch?v=secret",
                                "domain": "www.youtube.com",
                                "page_title": "Sensitive payload attempt",
                                "content_snippet": "This accepted text is safe.",
                                "token": "secret-token-value",
                            },
                        ]
                    },
                    format="json",
                )

        self.assertEqual(distracted.status_code, status.HTTP_200_OK)
        complete_json.assert_not_called()
        self.assertEqual(distracted.data["accepted_count"], 1)
        self.assertEqual(distracted.data["rejected_count"], 1)
        self.assertEqual(
            distracted.data["hybrid_decisions"][0]["result"]["state"],
            "DISTRACTED",
        )
        self.assertTrue(
            distracted.data["hybrid_decisions"][0]["result"][
                "should_start_warning_cycle"
            ]
        )
        self.assertFalse(BrowserEvent.objects.filter(url__contains="secret").exists())
        self.assertFalse(BrowserEvent.objects.filter(content_snippet__contains="secret-token").exists())

        cycle = WarningCycle.objects.get(session_id=session.id)
        warning_service = WarningCycleService(interval_seconds=1, max_level=3)
        with patch.object(WarningCycleService, "schedule_advance"):
            warning_service.advance_cycle(cycle.id, now=cycle.next_warning_at)
        cycle.refresh_from_db()
        warning_service.advance_cycle(cycle.id, now=cycle.next_warning_at)
        cycle.refresh_from_db()
        session.refresh_from_db()

        warnings = self.client.get(f"/api/sessions/{session.id}/warnings/")
        realtime = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        self.assertEqual(warnings.status_code, status.HTTP_200_OK)
        self.assertEqual(warnings.data["warning_count"], 3)
        self.assertEqual(
            [item["level"] for item in warnings.data["warnings"]],
            [1, 2, 3],
        )
        self.assertEqual(warnings.data["active_cycle"]["status"], "auto_pause_required")
        self.assertTrue(warnings.data["active_cycle"]["auto_pause_required"])
        self.assertEqual(cycle.action, WarningCycle.Action.AUTO_PAUSE)
        self.assertEqual(session.status, FocusSession.Status.ACTIVE)
        self.assertEqual(WarningEvent.objects.filter(session_id=session.id).count(), 3)

        self.assertEqual(realtime.status_code, status.HTTP_200_OK)
        self.assertEqual(realtime.data["session_id"], str(session.id))
        self.assertEqual(realtime.data["ai_status"], "DISABLED")
        self.assertGreaterEqual(realtime.data["score"], 0)
        self.assertLessEqual(realtime.data["score"], 100)
        self.assertIn("content_relevance", realtime.data["components"])

        self.client.force_authenticate(self.other_user)
        other_warnings = self.client.get(f"/api/sessions/{session.id}/warnings/")
        other_score = self.client.get(f"/api/sessions/{session.id}/score/realtime/")
        self.assertEqual(other_warnings.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(other_score.status_code, status.HTTP_404_NOT_FOUND)

    def test_event_ingest_uses_rule_fallback_when_realtime_ai_is_disabled(self):
        session = FocusSession.objects.create(
            user=self.user,
            mode=FocusSession.Mode.DEEP_WORK,
            goal="Study integration behavior",
            status=FocusSession.Status.ACTIVE,
            target_duration_seconds=1800,
        )

        with patch.object(AIClient, "complete_json", side_effect=AIProviderError()) as complete_json:
            response = self.client.post(
                f"/api/sessions/{session.id}/events/batch/",
                {
                    "events": [
                        {
                            "event_type": "url_change",
                            "url": "https://docs.djangoproject.com/",
                            "domain": "docs.djangoproject.com",
                            "page_title": "Django docs",
                            "content_snippet": "Django documentation.",
                            "active_seconds": 20,
                        }
                    ]
                },
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complete_json.assert_not_called()
        self.assertEqual(response.data["accepted_count"], 1)
        self.assertEqual(response.data["ai"]["status"], "DISABLED")
        self.assertEqual(response.data["ai"]["fallback_count"], 1)
        self.assertEqual(
            response.data["hybrid_decisions"][0]["result"]["decision_source"],
            "RULE_ONLY_FALLBACK",
        )
        self.assertEqual(BrowserEvent.objects.filter(session_id=session.id).count(), 1)
        self.assertFalse(AIAnalysisResult.objects.exists())

    def test_document_upload_extraction_summary_flashcards_and_owner_isolation(self):
        uploaded = SimpleUploadedFile(
            "focus-notes.txt",
            (
                b"FocusOS study sessions improve when students set clear goals. "
                b"Students should review extracted study material and reduce distractions."
            ),
            content_type="text/plain",
        )
        upload = self.client.post(
            "/api/documents/upload/",
            {"file": uploaded},
            format="multipart",
        )
        self.assertEqual(upload.status_code, status.HTTP_201_CREATED)
        document = StudyDocument.objects.get(pk=upload.data["id"])
        self.assertEqual(document.status, StudyDocument.Status.READY)
        self.assertIn("FocusOS study sessions", document.extracted_text)
        self.assertEqual(document.metadata["extraction"]["status"], "completed")

        with patch("apps.ai.views.generate_document_summary.delay") as delay:
            with self.captureOnCommitCallbacks(execute=True) as summary_callbacks:
                summary_request = self.client.post(
                    f"/api/documents/{document.id}/summary/",
                    {"mode": "detailed", "prompt": "ignored", "model": "ignored"},
                    format="json",
                )
        self.assertEqual(summary_request.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(len(summary_callbacks), 1)
        delay.assert_called_once_with(str(document.id), "detailed", force=False)
        self.assertNotIn("ignored", str(summary_request.data).lower())
        self.assertNotIn(document.extracted_text, str(summary_request.data))

        with patch.object(AIClient, "complete_json", return_value=detailed_summary_response()):
            summary_result = generate_document_summary.run(str(document.id), "detailed")
        self.assertEqual(summary_result["status"], DocumentSummary.Status.COMPLETED)
        summary = DocumentSummary.objects.get(document=document, mode="detailed")
        self.assertEqual(summary.status, DocumentSummary.Status.COMPLETED)
        self.assertEqual(summary.input_checksum, document.metadata["extraction"]["checksum"])
        self.assertIn("FocusOS Study Notes", summary.content)

        summary_get = self.client.get(f"/api/documents/{document.id}/summary/?mode=detailed")
        self.assertEqual(summary_get.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_get.data["summary"]["status"], DocumentSummary.Status.COMPLETED)
        self.assertNotIn(document.extracted_text, str(summary_get.data))

        with patch("apps.ai.views.generate_document_summary.delay") as delay:
            cached_summary = self.client.post(
                f"/api/documents/{document.id}/summary/",
                {"mode": "detailed"},
                format="json",
            )
        self.assertEqual(cached_summary.status_code, status.HTTP_200_OK)
        self.assertTrue(cached_summary.data["cached"])
        delay.assert_not_called()

        config = {"scope": "full_document", "quantity": 2, "difficulty": "medium"}
        with patch("apps.ai.views.generate_document_flashcards.delay") as delay:
            with self.captureOnCommitCallbacks(execute=True) as card_callbacks:
                cards_request = self.client.post(
                    f"/api/documents/{document.id}/flashcards/generate/",
                    {**config, "text": "ignored raw text"},
                    format="json",
                )
        self.assertEqual(cards_request.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(len(card_callbacks), 1)
        delay.assert_called_once()
        self.assertNotIn("ignored raw text", str(cards_request.data))

        with patch.object(AIClient, "complete_json", return_value=flashcard_response()):
            cards_result = generate_document_flashcards.run(str(document.id), config)
        self.assertEqual(cards_result["status"], FlashcardDeck.Status.COMPLETED)
        deck = FlashcardDeck.objects.get(document=document)
        self.assertEqual(deck.generated_quantity, 2)
        self.assertEqual(Flashcard.objects.filter(deck=deck).count(), 2)
        self.assertNotIn(document.extracted_text, str(deck.scope))

        with patch("apps.ai.views.generate_document_flashcards.delay") as delay:
            cached = self.client.post(
                f"/api/documents/{document.id}/flashcards/generate/",
                config,
                format="json",
            )
        self.assertEqual(cached.status_code, status.HTTP_200_OK)
        self.assertTrue(cached.data["cached"])
        delay.assert_not_called()

        old_checksum = document.metadata["extraction"]["checksum"]
        old_deck_id = deck.id
        DocumentExtractionService().extract_document(
            document.id,
            content=(
                b"FocusOS sessions now include retrieval practice and spaced review. "
                b"Students compare stale generated study tools with fresh extraction results."
            ),
            filename="focus-notes.txt",
            mime_type="text/plain",
            force=True,
        )
        document.refresh_from_db()
        self.assertNotEqual(document.metadata["extraction"]["checksum"], old_checksum)

        with patch("apps.ai.views.generate_document_summary.delay") as delay:
            with self.captureOnCommitCallbacks(execute=True):
                stale_summary_request = self.client.post(
                    f"/api/documents/{document.id}/summary/",
                    {"mode": "detailed"},
                    format="json",
                )
        self.assertEqual(stale_summary_request.status_code, status.HTTP_202_ACCEPTED)
        delay.assert_called_once_with(str(document.id), "detailed", force=False)
        summary.refresh_from_db()
        self.assertEqual(summary.status, DocumentSummary.Status.PENDING)
        self.assertEqual(summary.input_checksum, document.metadata["extraction"]["checksum"])

        with patch("apps.ai.views.generate_document_flashcards.delay") as delay:
            with self.captureOnCommitCallbacks(execute=True):
                stale_cards_request = self.client.post(
                    f"/api/documents/{document.id}/flashcards/generate/",
                    config,
                    format="json",
                )
        self.assertEqual(stale_cards_request.status_code, status.HTTP_202_ACCEPTED)
        delay.assert_called_once()
        deck.refresh_from_db()
        self.assertEqual(deck.status, FlashcardDeck.Status.STALE)
        self.assertTrue(
            FlashcardDeck.objects.filter(document=document, status=FlashcardDeck.Status.PENDING)
            .exclude(id=old_deck_id)
            .exists()
        )

        self.client.force_authenticate(self.other_user)
        other_summary = self.client.get(f"/api/documents/{document.id}/summary/?mode=detailed")
        other_cards = self.client.post(
            f"/api/documents/{document.id}/flashcards/generate/",
            config,
            format="json",
        )
        self.assertEqual(other_summary.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(other_cards.status_code, status.HTTP_404_NOT_FOUND)

    def test_flashcard_generation_deduplicates_invalid_ai_output(self):
        uploaded = SimpleUploadedFile(
            "dedupe-notes.txt",
            (
                b"FocusOS study sessions improve when students set clear goals. "
                b"Clear goals improve FocusOS study sessions and review habits."
            ),
            content_type="text/plain",
        )
        upload = self.client.post(
            "/api/documents/upload/",
            {"file": uploaded},
            format="multipart",
        )
        self.assertEqual(upload.status_code, status.HTTP_201_CREATED)
        document = StudyDocument.objects.get(pk=upload.data["id"])
        config = {"scope": "full_document", "quantity": 3, "difficulty": "medium"}

        with patch("apps.ai.views.generate_document_flashcards.delay"):
            with self.captureOnCommitCallbacks(execute=True):
                request = self.client.post(
                    f"/api/documents/{document.id}/flashcards/generate/",
                    config,
                    format="json",
                )
        self.assertEqual(request.status_code, status.HTTP_202_ACCEPTED)

        with patch.object(AIClient, "complete_json", return_value=duplicate_flashcard_response()) as complete_json:
            result = generate_document_flashcards.run(str(document.id), config)

        self.assertEqual(result["status"], FlashcardDeck.Status.PARTIAL)
        self.assertEqual(result["generated_quantity"], 1)
        deck = FlashcardDeck.objects.get(document=document)
        self.assertEqual(deck.status, FlashcardDeck.Status.PARTIAL)
        self.assertEqual(deck.error_code, "INSUFFICIENT_AI_OUTPUT")
        self.assertEqual(Flashcard.objects.filter(deck=deck).count(), 1)
        self.assertEqual(complete_json.call_count, 2)

    def test_async_task_boundaries_use_primitive_arguments(self):
        task_contracts = {
            "generate_session_insight": generate_session_insight,
            "extract_document_text": extract_document_text,
            "generate_document_summary": generate_document_summary,
            "generate_document_flashcards": generate_document_flashcards,
        }

        for task_name, task in task_contracts.items():
            with self.subTest(task=task_name):
                signature = inspect.signature(task.run)
                parameter_names = list(signature.parameters)
                self.assertNotIn("request", parameter_names)
                self.assertNotIn("user", parameter_names)
                self.assertNotIn("document", parameter_names)
                self.assertNotIn("extracted_text", parameter_names)
                self.assertNotIn("prompt", parameter_names)

        self.assertEqual(
            list(inspect.signature(generate_session_insight.run).parameters),
            ["session_id"],
        )
        self.assertEqual(
            list(inspect.signature(generate_document_summary.run).parameters),
            ["document_id", "mode", "force"],
        )
        self.assertEqual(
            list(inspect.signature(generate_document_flashcards.run).parameters),
            ["document_id", "config", "force"],
        )

        missing_id = "00000000-0000-0000-0000-000000000000"
        missing_summary = generate_document_summary.run(missing_id, "detailed")
        missing_cards = generate_document_flashcards.run(
            missing_id,
            {"scope": "full_document", "quantity": 2, "difficulty": "medium"},
        )
        self.assertEqual(missing_summary["status"], "skipped")
        self.assertEqual(missing_summary["error_code"], "DOCUMENT_NOT_FOUND")
        self.assertFalse(missing_summary["retryable"])
        self.assertEqual(missing_cards["status"], "skipped")
        self.assertEqual(missing_cards["error_code"], "DOCUMENT_NOT_FOUND")
        self.assertFalse(missing_cards["retryable"])

        self.assertEqual(EventBatch.objects.count(), 0)

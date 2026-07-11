import json
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.ai.models import AIAnalysisResult, SessionInsight
from apps.ai.services.ai_client import AIClient
from apps.scoring.models import FocusScore
from apps.tracking.models import BrowserEvent, WarningEvent

from .models import (
    FocusSession,
    GoalTemplate,
    SessionNote,
    SessionStateTransition,
    SessionTag,
)


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


class GoalTemplateApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="templates@example.com", password=PASSWORD)
        self.other_user = User.objects.create_user(
            email="other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def test_built_in_templates_are_seeded_and_available_through_alias(self):
        response = self.client.get("/api/goal-templates/")
        alias = self.client.get("/api/sessions/templates/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 15)
        self.assertTrue(all(template["isBuiltIn"] for template in response.data))
        self.assertEqual(alias.status_code, status.HTTP_200_OK)
        self.assertEqual(len(alias.data), 15)

    def test_smart_preset_uses_user_preferences(self):
        self.user.preferences.default_mode = "deep-work"
        self.user.preferences.default_duration_minutes = 90
        self.user.preferences.save()

        response = self.client.get("/api/sessions/smart-preset/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["mode"], "deep-work")
        self.assertEqual(response.data["durationMinutes"], 90)

    def test_custom_template_crud_and_ownership(self):
        create = self.client.post(
            "/api/goal-templates/",
            {"label": "Custom", "text": "Finish custom task"},
            format="json",
        )
        template_id = create.data["id"]
        update = self.client.patch(
            f"/api/goal-templates/{template_id}/",
            {"text": "Updated custom task"},
            format="json",
        )

        self.assertEqual(create.status_code, status.HTTP_201_CREATED)
        self.assertFalse(create.data["isBuiltIn"])
        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertEqual(update.data["text"], "Updated custom task")

        self.client.force_authenticate(self.other_user)
        self.assertEqual(
            self.client.get(f"/api/goal-templates/{template_id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.client.force_authenticate(self.user)
        delete = self.client.delete(f"/api/goal-templates/{template_id}/")
        self.assertEqual(delete.status_code, status.HTTP_204_NO_CONTENT)

    def test_built_in_template_cannot_be_changed_or_deleted(self):
        template = GoalTemplate.objects.get(pk="tpl-code-project")

        update = self.client.patch(
            f"/api/goal-templates/{template.pk}/",
            {"text": "Changed"},
            format="json",
        )
        delete = self.client.delete(f"/api/goal-templates/{template.pk}/")

        self.assertEqual(update.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(delete.status_code, status.HTTP_403_FORBIDDEN)


class SessionSummaryDataTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="summary@example.com", password=PASSWORD)
        self.client.force_authenticate(self.user)

    def test_summary_uses_persisted_insight_warnings_and_browser_events(self):
        session = FocusSession.objects.create(
            user=self.user,
            mode=FocusSession.Mode.DEEP_WORK,
            goal="Study contracts",
            status=FocusSession.Status.COMPLETED,
            target_duration_seconds=3000,
            actual_duration_seconds=2400,
            focus_score=82,
            ended_at=timezone.now(),
        )
        insight = SessionInsight.objects.create(
            session=session,
            status=SessionInsight.Status.COMPLETED,
            observations=["Warnings clustered around video sites."],
            source=SessionInsight.Source.RULE_BASED_FALLBACK,
            generated_at=timezone.now(),
        )
        event = BrowserEvent.objects.create(
            session_id=session.id,
            event_type="url_change",
            domain="youtube.com",
        )
        WarningEvent.objects.create(
            session_id=session.id,
            browser_event=event,
            warning_level=2,
            warning_type=WarningEvent.WarningType.DEEP_WORK_AI,
            domain="youtube.com",
            decision_state="DISTRACTED",
            decision_source="HYBRID",
            decision_score=86,
            reason_codes=["CONTENT_NOT_RELEVANT"],
        )

        response = self.client.get(f"/api/sessions/{session.id}/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["aiInsights"], insight.observations)
        self.assertTrue(response.data["isAiInsightReady"])
        self.assertEqual(response.data["distractionEvents"][0]["domain"], "youtube.com")
        self.assertEqual(response.data["warningLog"][0]["decisionState"], "DISTRACTED")
        self.assertEqual(response.data["topDistractionDomains"][0]["domain"], "youtube.com")
        self.assertEqual(response.data["browserEventCount"], 1)


class SessionLifecycleApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="sessions@example.com", password=PASSWORD)
        self.other_user = User.objects.create_user(
            email="session-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def create_session(self, **overrides):
        payload = {
            "mode": "normal",
            "goal": "",
            "targetDurationSeconds": 3000,
            "tags": ["Backend", "AI"],
        }
        payload.update(overrides)
        return self.client.post("/api/sessions/", payload, format="json")

    def test_full_session_lifecycle_and_server_calculated_duration(self):
        create = self.create_session()
        session_id = create.data["id"]
        session = FocusSession.objects.get(pk=session_id)
        session.started_at = timezone.now() - timedelta(minutes=10)
        session.save(update_fields=["started_at"])

        pause = self.client.post(f"/api/sessions/{session_id}/pause/", format="json")
        resume = self.client.patch(
            f"/api/sessions/{session_id}/",
            {"status": "active", "note": "Working on auth"},
            format="json",
        )
        end = self.client.post(
            f"/api/sessions/{session_id}/end/",
            {
                "actualDurationSeconds": 999999,
                "note": "Finished auth",
                "tags": ["Backend", "Testing"],
            },
            format="json",
        )

        self.assertEqual(create.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create.data["tags"], ["AI", "Backend"])
        self.assertEqual(pause.status_code, status.HTTP_200_OK)
        self.assertEqual(pause.data["status"], "paused")
        self.assertEqual(resume.status_code, status.HTTP_200_OK)
        self.assertEqual(resume.data["status"], "active")
        self.assertEqual(end.status_code, status.HTTP_200_OK)
        self.assertEqual(end.data["status"], "completed")
        self.assertEqual(end.data["note"], "Finished auth")
        self.assertLess(end.data["actualDurationSeconds"], 999999)
        self.assertGreaterEqual(end.data["actualDurationSeconds"], 590)

        session.refresh_from_db()
        self.user.profile.refresh_from_db()
        self.assertEqual(session.state_transitions.count(), 4)
        self.assertEqual(self.user.profile.total_sessions, 1)
        self.assertIsNotNone(session.focus_score)
        self.assertEqual(session.focus_state, "focused")

    def test_deep_work_requires_goal_and_template_can_supply_it(self):
        invalid = self.create_session(mode="deep-work", goal="")
        valid = self.create_session(
            mode="deep-work",
            goal="",
            goalTemplateId="tpl-code-project",
        )

        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("goal", invalid.data)
        self.assertEqual(valid.status_code, status.HTTP_201_CREATED)
        self.assertEqual(valid.data["goal"], "Work on my coding project")

        template = GoalTemplate.objects.get(pk="tpl-code-project")
        self.assertEqual(template.usage_count, 1)
        self.assertIsNotNone(template.last_used_at)

    def test_resume_action_and_patch_lifecycle_compatibility(self):
        create = self.create_session()
        session_id = create.data["id"]

        pause_action = self.client.post(
            f"/api/sessions/{session_id}/pause/",
            format="json",
        )
        resume_action = self.client.post(
            f"/api/sessions/{session_id}/resume/",
            format="json",
        )
        pause_patch = self.client.patch(
            f"/api/sessions/{session_id}/",
            {"status": "paused"},
            format="json",
        )
        resume_patch = self.client.patch(
            f"/api/sessions/{session_id}/",
            {"status": "active"},
            format="json",
        )

        self.assertEqual(pause_action.data["status"], "paused")
        self.assertEqual(resume_action.data["status"], "active")
        self.assertEqual(pause_patch.data["status"], "paused")
        self.assertEqual(resume_patch.data["status"], "active")

    def test_pause_and_resume_require_expected_source_status(self):
        create = self.create_session()
        session_id = create.data["id"]

        resume_active = self.client.post(
            f"/api/sessions/{session_id}/resume/",
            format="json",
        )
        pause_active = self.client.post(
            f"/api/sessions/{session_id}/pause/",
            format="json",
        )
        pause_paused = self.client.post(
            f"/api/sessions/{session_id}/pause/",
            format="json",
        )
        resume_paused = self.client.post(
            f"/api/sessions/{session_id}/resume/",
            format="json",
        )

        self.assertEqual(resume_active.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(pause_active.status_code, status.HTTP_200_OK)
        self.assertEqual(pause_paused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resume_paused.status_code, status.HTTP_200_OK)

    def test_terminal_sessions_reject_end_and_cancel(self):
        completed = self.create_session()
        completed_id = completed.data["id"]
        self.client.post(f"/api/sessions/{completed_id}/end/", format="json")

        end_completed = self.client.post(
            f"/api/sessions/{completed_id}/end/",
            format="json",
        )
        cancel_completed = self.client.post(
            f"/api/sessions/{completed_id}/cancel/",
            format="json",
        )

        cancelled = self.create_session()
        cancelled_id = cancelled.data["id"]
        self.client.post(f"/api/sessions/{cancelled_id}/cancel/", format="json")

        end_cancelled = self.client.post(
            f"/api/sessions/{cancelled_id}/end/",
            format="json",
        )
        cancel_cancelled = self.client.post(
            f"/api/sessions/{cancelled_id}/cancel/",
            format="json",
        )

        self.assertEqual(end_completed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(cancel_completed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(end_cancelled.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(cancel_cancelled.status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_one_open_session_and_at_most_three_tags(self):
        first = self.create_session()
        second = self.create_session()
        too_many_tags = self.client.post(
            f"/api/sessions/{first.data['id']}/cancel/",
            format="json",
        )
        after_cancel = self.create_session(tags=["one", "two", "three", "four"])

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(too_many_tags.status_code, status.HTTP_200_OK)
        self.assertEqual(after_cancel.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tags", after_cancel.data)

    def test_invalid_transition_and_cross_user_access_are_rejected(self):
        create = self.create_session()
        session_id = create.data["id"]
        session = FocusSession.objects.get(pk=session_id)
        session.started_at = timezone.now() - timedelta(minutes=60)
        session.save(update_fields=["started_at"])
        self.client.post(f"/api/sessions/{session_id}/end/", format="json")

        invalid_transition = self.client.post(
            f"/api/sessions/{session_id}/resume/",
            format="json",
        )
        self.client.force_authenticate(self.other_user)
        other_access = self.client.get(f"/api/sessions/{session_id}/")

        self.assertEqual(invalid_transition.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(other_access.status_code, status.HTTP_404_NOT_FOUND)

    def test_cancelled_session_is_stored_and_history_is_user_scoped(self):
        create = self.create_session(name="Cancelled session")
        session_id = create.data["id"]
        cancel = self.client.post(f"/api/sessions/{session_id}/cancel/", format="json")
        history = self.client.get("/api/sessions/?page=1&limit=10")

        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel.data["status"], "cancelled")
        self.assertTrue(FocusSession.objects.filter(pk=session_id).exists())
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(history.data["count"], 1)
        self.assertEqual(history.data["results"][0]["id"], session_id)
        self.assertEqual(
            SessionStateTransition.objects.filter(session_id=session_id).count(),
            2,
        )

    def test_completed_session_summary_supports_frontend_flow(self):
        create = self.create_session()
        session_id = create.data["id"]
        self.client.post(f"/api/sessions/{session_id}/end/", format="json")

        response = self.client.get(f"/api/sessions/{session_id}/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["session"]["id"], session_id)
        self.assertEqual(response.data["scoreBreakdown"]["total"], 70)
        self.assertEqual(response.data["scoreMetadata"]["source"], "duration_fallback")
        self.assertEqual(response.data["warningLog"], [])
        self.assertEqual(response.data["aiInsights"], [])
        self.assertFalse(response.data["isAiInsightReady"])
        self.assertTrue(FocusScore.objects.filter(session_id=session_id).exists())

    def test_week_4_tag_crud_and_history_filter(self):
        create_tag = self.client.post(
            "/api/tags/",
            {"name": "Backend"},
            format="json",
        )
        tag_id = create_tag.data["id"]
        rename = self.client.patch(
            f"/api/tags/{tag_id}/",
            {"name": "Backend API"},
            format="json",
        )
        create = self.create_session(tags=["Backend API"])
        filtered = self.client.get("/api/sessions/?tag=Backend%20API")
        delete = self.client.delete(f"/api/tags/{tag_id}/")

        self.assertEqual(create_tag.status_code, status.HTTP_201_CREATED)
        self.assertEqual(rename.status_code, status.HTTP_200_OK)
        self.assertEqual(rename.data["name"], "Backend API")
        self.assertEqual(create.status_code, status.HTTP_201_CREATED)
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertEqual(filtered.data["count"], 1)
        self.assertEqual(delete.status_code, status.HTTP_204_NO_CONTENT)

    def test_week_4_session_note_search_and_recent_context(self):
        create = self.create_session(goal="Finish note API")
        session_id = create.data["id"]
        note = self.client.put(
            f"/api/sessions/{session_id}/note/",
            {"content": "Remember the searchable note flow."},
            format="json",
        )
        read_note = self.client.get(f"/api/sessions/{session_id}/note/")
        history = self.client.get("/api/sessions/?noteSearch=searchable")
        context = self.client.get("/api/recent-context/")

        self.assertEqual(note.status_code, status.HTTP_200_OK)
        self.assertEqual(read_note.data["content"], "Remember the searchable note flow.")
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(history.data["count"], 1)
        self.assertEqual(context.status_code, status.HTTP_200_OK)
        self.assertEqual(context.data["status"], "empty")
        self.assertFalse(context.data["has_context"])
        self.assertIsNone(context.data["recent_context"])
        self.assertEqual(context.data["active_session"]["session_id"], session_id)
        self.assertNotIn("recentNotes", context.data)
        self.assertNotIn("recentGoals", context.data)

    def test_summary_is_user_scoped_and_handles_missing_score(self):
        session = FocusSession.objects.create(
            user=self.user,
            mode=FocusSession.Mode.NORMAL,
            status=FocusSession.Status.COMPLETED,
            target_duration_seconds=1800,
            actual_duration_seconds=900,
            ended_at=timezone.now(),
        )

        response = self.client.get(f"/api/sessions/{session.pk}/summary/")
        self.client.force_authenticate(self.other_user)
        other_user_response = self.client.get(f"/api/sessions/{session.pk}/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["session"]["id"], str(session.pk))
        self.assertIsNone(response.data["scoreBreakdown"])
        self.assertEqual(response.data["scoreMetadata"], {})
        self.assertEqual(response.data["warningLog"], [])
        self.assertEqual(other_user_response.status_code, status.HTTP_404_NOT_FOUND)


class RecentLearningContextDay23Tests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="recent-context@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="recent-context-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def create_session(self, user=None, **overrides):
        now = timezone.now()
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.NORMAL,
            "goal": "Study Django ORM",
            "status": FocusSession.Status.COMPLETED,
            "target_duration_seconds": 3000,
            "actual_duration_seconds": 2760,
            "started_at": now - timedelta(minutes=50),
            "ended_at": now - timedelta(minutes=4),
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def test_authentication_required(self):
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/recent-context/")

        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_empty_when_no_completed_session_with_valid_goal(self):
        self.create_session(goal="   ")
        self.create_session(goal="")
        self.create_session(user=self.other_user, goal="Other user goal")

        response = self.client.get("/api/recent-context/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "empty")
        self.assertFalse(response.data["has_context"])
        self.assertIsNone(response.data["recent_context"])
        self.assertIsNone(response.data["reuse_config"])
        self.assertIsNone(response.data["active_session"])

    def test_selects_latest_completed_valid_goal_skips_invalid_sessions(self):
        old = self.create_session(
            goal="Old valid goal",
            started_at=timezone.now() - timedelta(days=3, minutes=50),
            ended_at=timezone.now() - timedelta(days=3),
        )
        latest = self.create_session(
            goal="Latest completed goal",
            started_at=timezone.now() - timedelta(days=1, minutes=50),
            ended_at=timezone.now() - timedelta(days=1),
        )
        self.create_session(
            goal="Cancelled should not win",
            status=FocusSession.Status.CANCELLED,
            ended_at=timezone.now(),
        )
        self.create_session(
            goal="Other user should not win",
            user=self.other_user,
            ended_at=timezone.now(),
        )
        FocusSession.objects.create(
            user=self.user,
            mode=FocusSession.Mode.DEEP_WORK,
            goal="Active should be separate",
            status=FocusSession.Status.ACTIVE,
            target_duration_seconds=1800,
            started_at=timezone.now(),
        )

        response = self.client.get("/api/recent-context/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ready")
        self.assertTrue(response.data["has_context"])
        self.assertEqual(response.data["recent_context"]["session_id"], str(latest.id))
        self.assertNotEqual(response.data["recent_context"]["session_id"], str(old.id))
        self.assertEqual(
            response.data["active_session"]["goal"],
            "Active should be separate",
        )

    def test_goal_normalization_mode_duration_and_reuse_config(self):
        session = self.create_session(
            mode=FocusSession.Mode.DEEP_WORK,
            goal=" \x00Hoàn thành API\r\nGiữ nguyên Case  ",
            target_duration_seconds=3000,
            actual_duration_seconds=0,
            started_at=timezone.now() - timedelta(minutes=47),
            ended_at=timezone.now(),
        )

        response = self.client.get("/api/recent-context/")

        context = response.data["recent_context"]
        reuse = response.data["reuse_config"]
        self.assertEqual(context["session_id"], str(session.id))
        self.assertEqual(context["goal"], "Hoàn thành API\nGiữ nguyên Case")
        self.assertEqual(context["mode"], "deep_work")
        self.assertEqual(context["target_duration_minutes"], 50)
        self.assertEqual(context["actual_duration_minutes"], 47)
        self.assertEqual(reuse["goal"], context["goal"])
        self.assertEqual(reuse["mode"], "deep_work")
        self.assertTrue(reuse["requires_goal"])
        self.assertEqual(reuse["duration_minutes"], 50)

    def test_tags_are_limited_to_three_and_reused_by_id(self):
        session = self.create_session(goal="Tagged context")
        tags = [
            SessionTag.objects.create(user=self.user, name=name)
            for name in ["Backend", "AI", "Docs", "Zeta"]
        ]
        other_tag = SessionTag.objects.create(user=self.other_user, name="Private")
        session.tags.add(*tags, other_tag)

        response = self.client.get("/api/recent-context/")

        returned_tags = response.data["recent_context"]["tags"]
        returned_names = [tag["name"] for tag in returned_tags]
        returned_ids = [tag["id"] for tag in returned_tags]
        self.assertEqual(returned_names, ["AI", "Backend", "Docs"])
        self.assertEqual(response.data["reuse_config"]["tag_ids"], returned_ids)
        self.assertNotIn(str(other_tag.id), returned_ids)

    def test_active_session_is_returned_but_not_used_as_recent_context(self):
        FocusSession.objects.create(
            user=self.user,
            mode=FocusSession.Mode.DEEP_WORK,
            goal="Current deep work",
            status=FocusSession.Status.PAUSED,
            target_duration_seconds=5400,
            started_at=timezone.now(),
        )

        response = self.client.get("/api/recent-context/")

        self.assertEqual(response.data["status"], "empty")
        self.assertIsNone(response.data["recent_context"])
        self.assertEqual(response.data["active_session"]["goal"], "Current deep work")
        self.assertEqual(response.data["active_session"]["mode"], "deep_work")

    def test_privacy_excludes_urls_titles_snippets_notes_and_warning_messages(self):
        session = self.create_session(goal="Private-safe goal")
        event = BrowserEvent.objects.create(
            session_id=session.id,
            event_type="tab_active",
            url="https://private.example.com/full/path",
            domain="private.example.com",
            page_title="Secret title",
            meta_description="Secret description",
            content_snippet="Secret snippet",
        )
        WarningEvent.objects.create(
            session_id=session.id,
            browser_event=event,
            warning_level=1,
            warning_type=WarningEvent.WarningType.MANUAL,
            domain="private.example.com",
            url="https://private.example.com/full/path",
            message="Secret warning message",
        )
        SessionNote.objects.create(session=session, content="Secret session note")

        response = self.client.get("/api/recent-context/")

        payload = json.dumps(response.data, ensure_ascii=False)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("https://private.example.com/full/path", payload)
        self.assertNotIn("Secret title", payload)
        self.assertNotIn("Secret description", payload)
        self.assertNotIn("Secret snippet", payload)
        self.assertNotIn("Secret warning message", payload)
        self.assertNotIn("Secret session note", payload)

    def test_recent_context_does_not_call_ai(self):
        self.create_session(goal="No AI context")

        with patch.object(AIClient, "complete_json") as complete_json:
            response = self.client.get("/api/recent-context/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complete_json.assert_not_called()

    def test_unsupported_methods_return_405(self):
        for method in ["post", "put", "patch", "delete"]:
            response = getattr(self.client, method)("/api/recent-context/")
            self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class RealtimeScoreApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="realtime@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="realtime-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def create_session(self, user=None, **overrides):
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.DEEP_WORK,
            "goal": "Study DRF serializers",
            "status": FocusSession.Status.ACTIVE,
            "target_duration_seconds": 3000,
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def create_event(self, session, **overrides):
        values = {
            "session_id": session.id,
            "event_type": "url_change",
            "domain": "docs.example.com",
            "active_seconds": 30,
            "idle_seconds": 0,
            "tab_switch_count": 1,
        }
        values.update(overrides)
        return BrowserEvent.objects.create(**values)

    def create_events(self, session, count=3, **overrides):
        return [self.create_event(session, **overrides) for _ in range(count)]

    def create_analysis(self, session, event, score=80, focus_state=None):
        return AIAnalysisResult.objects.create(
            session_id=session.id,
            browser_event_id=event.id,
            provider="test",
            model_name="test-model",
            relevance_score=score,
            is_relevant=score >= 70,
            focus_state=focus_state or AIAnalysisResult.FocusState.FOCUSED,
            raw_response={"classification": "RELEVANT", "confidence": 0.8},
        )

    def test_anonymous_request_is_denied(self):
        session = self.create_session()
        self.client.force_authenticate(user=None)

        response = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_owner_gets_realtime_score_for_active_session(self):
        session = self.create_session()
        events = self.create_events(session)
        for event in events:
            self.create_analysis(session, event, score=90)

        response = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["session_id"], str(session.id))
        self.assertEqual(response.data["session_status"], FocusSession.Status.ACTIVE)
        self.assertIsNotNone(response.data["score"])
        self.assertIn("label", response.data)
        self.assertIn("components", response.data)
        self.assertIn("data_quality", response.data)
        self.assertIn("stale", response.data)

    def test_realtime_score_uses_warning_events_for_distraction_control(self):
        session = self.create_session()
        events = self.create_events(session)
        for event in events:
            self.create_analysis(session, event, score=90)
        WarningEvent.objects.create(
            session_id=session.id,
            warning_level=3,
            warning_type=WarningEvent.WarningType.DEEP_WORK_AI,
            decision_state="DISTRACTED",
            decision_source="HYBRID",
            decision_score=90,
            domain="video.example.com",
        )

        response = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["source"], "tracking_signals")
        self.assertEqual(response.data["warning_count"], 1)
        self.assertLess(response.data["components"]["distraction_control"], 100)

    def test_owner_gets_realtime_score_for_paused_session(self):
        session = self.create_session(status=FocusSession.Status.PAUSED)
        self.create_events(session)

        response = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["session_status"], FocusSession.Status.PAUSED)

    def test_other_user_cannot_view_session_score(self):
        session = self.create_session()

        self.client.force_authenticate(self.other_user)
        response = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_missing_session_returns_404(self):
        response = self.client.get(
            "/api/sessions/00000000-0000-0000-0000-000000000000/score/realtime/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_insufficient_data_still_returns_200(self):
        session = self.create_session()

        response = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["score"])
        self.assertIsNone(response.data["label"])
        self.assertEqual(response.data["event_count"], 0)
        self.assertEqual(response.data["data_quality"], "INSUFFICIENT")

    def test_stale_data_returns_stale_true(self):
        session = self.create_session()
        events = self.create_events(session)
        old_time = timezone.now() - timedelta(seconds=120)
        BrowserEvent.objects.filter(pk__in=[event.pk for event in events]).update(
            created_at=old_time,
        )

        response = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["stale"])

    def test_query_uses_only_events_for_requested_session(self):
        session = self.create_session()
        other_session = FocusSession.objects.create(
            user=self.other_user,
            mode=FocusSession.Mode.DEEP_WORK,
            goal="Other",
            status=FocusSession.Status.ACTIVE,
            target_duration_seconds=3000,
        )
        self.create_events(session, count=3)
        self.create_events(other_session, count=5)

        response = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["event_count"], 3)

    def test_query_uses_only_analysis_for_requested_session(self):
        session = self.create_session()
        other_session = FocusSession.objects.create(
            user=self.other_user,
            mode=FocusSession.Mode.DEEP_WORK,
            goal="Other",
            status=FocusSession.Status.ACTIVE,
            target_duration_seconds=3000,
        )
        events = self.create_events(session, count=3)
        other_event = self.create_event(other_session)
        self.create_analysis(other_session, other_event, score=0)
        self.create_analysis(session, events[0], score=100)

        response = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["components"]["content_relevance"], 100)

    def test_api_does_not_call_openrouter_create_warning_pause_or_write_focus_score(self):
        session = self.create_session()
        self.create_events(session)

        with patch.object(AIClient, "complete_json") as complete_json:
            response = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        session.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        complete_json.assert_not_called()
        self.assertFalse(WarningEvent.objects.exists())
        self.assertEqual(session.status, FocusSession.Status.ACTIVE)
        self.assertFalse(FocusScore.objects.filter(session=session).exists())

    def test_two_gets_do_not_create_duplicate_focus_score_records(self):
        session = self.create_session()
        FocusScore.objects.create(
            user=self.user,
            session=session,
            total_score=77,
            focus_state=FocusScore.State.FOCUSED,
        )
        self.create_events(session)

        first = self.client.get(f"/api/sessions/{session.id}/score/realtime/")
        second = self.client.get(f"/api/sessions/{session.id}/score/realtime/")

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(FocusScore.objects.filter(session=session).count(), 1)
        session.refresh_from_db()
        self.assertIsNone(session.focus_score)

    def test_closed_session_rejects_realtime_score_without_state_change(self):
        session = self.create_session(status=FocusSession.Status.COMPLETED)

        response = self.client.get(f"/api/sessions/{session.id}/score/realtime/")
        session.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(session.status, FocusSession.Status.COMPLETED)


class SessionAIInsightApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="session-insight-api@example.com",
            password=PASSWORD,
        )
        self.other_user = User.objects.create_user(
            email="session-insight-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def create_session(self, user=None, **overrides):
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.DEEP_WORK,
            "goal": "Study Django REST Framework",
            "status": FocusSession.Status.COMPLETED,
            "target_duration_seconds": 3000,
            "actual_duration_seconds": 2400,
            "ended_at": timezone.now(),
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def test_get_requires_authentication_and_is_owner_scoped(self):
        session = self.create_session()

        self.client.force_authenticate(user=None)
        anonymous = self.client.get(f"/api/sessions/{session.id}/ai-insight/")

        self.client.force_authenticate(self.other_user)
        other = self.client.get(f"/api/sessions/{session.id}/ai-insight/")

        self.assertIn(
            anonymous.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )
        self.assertEqual(other.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_pending_completed_and_failed_responses_do_not_enqueue_or_mutate(self):
        session = self.create_session()
        with patch("apps.ai.tasks.generate_session_insight.delay") as delay:
            pending = self.client.get(f"/api/sessions/{session.id}/ai-insight/")

        self.assertEqual(pending.status_code, status.HTTP_200_OK)
        self.assertEqual(pending.data["status"], SessionInsight.Status.PENDING)
        self.assertEqual(pending.data["observations"], [])
        self.assertFalse(SessionInsight.objects.filter(session=session).exists())
        delay.assert_not_called()

        insight = SessionInsight.objects.create(
            session=session,
            status=SessionInsight.Status.COMPLETED,
            observations=["Observation"],
            source=SessionInsight.Source.AI,
            model_name="test-model",
            generated_at=timezone.now(),
        )
        completed = self.client.get(f"/api/sessions/{session.id}/ai-insight/")

        self.assertEqual(completed.status_code, status.HTTP_200_OK)
        self.assertEqual(completed.data["status"], SessionInsight.Status.COMPLETED)
        self.assertEqual(completed.data["source"], SessionInsight.Source.AI)
        self.assertEqual(completed.data["model"], "test-model")
        self.assertNotIn("prompt", completed.data)
        self.assertNotIn("content_snippet", completed.data)

        insight.status = SessionInsight.Status.FAILED
        insight.observations = []
        insight.source = ""
        insight.error_code = "AI_PROVIDER_ERROR"
        insight.save()
        failed = self.client.get(f"/api/sessions/{session.id}/ai-insight/")

        self.assertEqual(failed.status_code, status.HTTP_200_OK)
        self.assertEqual(failed.data["status"], SessionInsight.Status.FAILED)
        self.assertEqual(failed.data["error_code"], "AI_PROVIDER_ERROR")

    def test_retry_failed_updates_same_record_and_queues_after_commit(self):
        session = self.create_session()
        insight = SessionInsight.objects.create(
            session=session,
            status=SessionInsight.Status.FAILED,
            error_code="AI_PROVIDER_ERROR",
        )

        with patch("apps.ai.tasks.generate_session_insight.delay") as delay:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    f"/api/sessions/{session.id}/ai-insight/retry/",
                    format="json",
                )

        insight.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], SessionInsight.Status.PENDING)
        self.assertEqual(response.data["retry_count"], 1)
        self.assertEqual(insight.retry_count, 1)
        self.assertEqual(SessionInsight.objects.filter(session=session).count(), 1)
        delay.assert_called_once_with(str(session.id))

    def test_retry_conflicts_for_processing_completed_limit_and_active_session(self):
        processing_session = self.create_session()
        SessionInsight.objects.create(
            session=processing_session,
            status=SessionInsight.Status.PROCESSING,
            started_at=timezone.now(),
        )
        processing = self.client.post(
            f"/api/sessions/{processing_session.id}/ai-insight/retry/",
            format="json",
        )

        completed_session = self.create_session(goal="Completed")
        SessionInsight.objects.create(
            session=completed_session,
            status=SessionInsight.Status.COMPLETED,
            source=SessionInsight.Source.AI,
        )
        completed = self.client.post(
            f"/api/sessions/{completed_session.id}/ai-insight/retry/",
            format="json",
        )

        limited_session = self.create_session(goal="Limited")
        SessionInsight.objects.create(
            session=limited_session,
            status=SessionInsight.Status.FAILED,
            retry_count=3,
        )
        limited = self.client.post(
            f"/api/sessions/{limited_session.id}/ai-insight/retry/",
            format="json",
        )

        active_session = self.create_session(
            goal="Active",
            status=FocusSession.Status.ACTIVE,
            ended_at=None,
        )
        active = self.client.post(
            f"/api/sessions/{active_session.id}/ai-insight/retry/",
            format="json",
        )

        self.assertEqual(processing.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            processing.data["error_code"],
            "INSIGHT_ALREADY_PROCESSING",
        )
        self.assertEqual(completed.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(completed.data["error_code"], "INSIGHT_ALREADY_COMPLETED")
        self.assertEqual(limited.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(limited.data["error_code"], "RETRY_LIMIT_REACHED")
        self.assertEqual(active.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retry_is_owner_scoped(self):
        session = self.create_session()
        SessionInsight.objects.create(
            session=session,
            status=SessionInsight.Status.FAILED,
        )

        self.client.force_authenticate(self.other_user)
        response = self.client.post(
            f"/api/sessions/{session.id}/ai-insight/retry/",
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

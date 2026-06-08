from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.scoring.models import FocusScore

from .models import FocusSession, GoalTemplate, SessionStateTransition


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
        self.assertEqual(response.data["scoreMetadata"]["source"], "session-duration-fallback")
        self.assertEqual(response.data["warningLog"], [])
        self.assertEqual(response.data["aiInsights"], [])
        self.assertFalse(response.data["isAiInsightReady"])
        self.assertTrue(FocusScore.objects.filter(session_id=session_id).exists())

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

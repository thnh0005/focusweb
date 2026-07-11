import json
import tempfile
import zipfile
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.core.files.base import ContentFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.ai.models import (
    AIAnalysisResult,
    DocumentSummary,
    Flashcard,
    FlashcardDeck,
    StudyDocument,
)
from apps.analytics.models import ReportExportJob
from apps.notifications.models import Notification
from apps.sessions.models import FocusSession
from apps.tracking.models import BrowserEvent, EventBatch, WarningCycle, WarningEvent

from .account_deletion import (
    AccountDeletionError,
    AccountDeletionService,
    cleanup_expired_account_deletion_receipts,
    hash_deletion_status_token,
    rotate_deletion_status_token,
)
from .account_export import (
    AccountDataExportService,
    cleanup_expired_account_exports,
    create_or_reuse_account_export_job,
)
from .models import AccountDataExportJob, AccountDeletionJob


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


class Day26Base(APITestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.tmp.name)
        self.override.enable()
        self.user = User.objects.create_user(email="day26@example.com", password=PASSWORD)
        self.other_user = User.objects.create_user(
            email="day26-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def tearDown(self):
        self.override.disable()
        self.tmp.cleanup()

    def create_session(self, user=None, **overrides):
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.NORMAL,
            "goal": "Export du lieu tieng Viet",
            "status": FocusSession.Status.COMPLETED,
            "target_duration_seconds": 3600,
            "actual_duration_seconds": 1800,
            "focus_score": 88,
            "focus_state": "focused",
            "started_at": timezone.now() - timedelta(hours=2),
            "ended_at": timezone.now() - timedelta(hours=1, minutes=30),
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def read_zip(self, job):
        with job.file.open("rb") as handle:
            return zipfile.ZipFile(BytesIO(handle.read()))


class AccountDataExportServiceTests(Day26Base):
    def test_export_archive_is_user_scoped_and_excludes_sensitive_fields(self):
        session = self.create_session()
        self.create_session(user=self.other_user, goal="Other user private goal")
        document = StudyDocument.objects.create(
            user=self.user,
            filename="server-name.pdf",
            original_name="Tai lieu.pdf",
            file_type=StudyDocument.FileType.PDF,
            extracted_text="Noi dung hoc tap",
            status=StudyDocument.Status.READY,
        )
        other_document = StudyDocument.objects.create(
            user=self.other_user,
            filename="other.pdf",
            original_name="Other.pdf",
            file_type=StudyDocument.FileType.PDF,
        )
        DocumentSummary.objects.create(
            document=document,
            mode=DocumentSummary.Mode.KEY_POINTS,
            status=DocumentSummary.Status.COMPLETED,
            content="Tom tat",
        )
        deck = FlashcardDeck.objects.create(
            user=self.user,
            document=document,
            title="Deck",
            quantity=1,
            requested_quantity=1,
            generated_quantity=1,
        )
        Flashcard.objects.create(
            deck=deck,
            document=document,
            question="Cau hoi?",
            answer="Cau tra loi",
            order=1,
        )
        event = BrowserEvent.objects.create(
            session_id=session.id,
            event_type="url_change",
            url="https://docs.example.com/path",
            domain="docs.example.com",
            page_title="Docs",
        )
        cycle = WarningCycle.objects.create(
            session_id=session.id,
            source_event=event,
            idempotency_key=f"test-cycle:{session.id}",
            mode=session.mode,
            status=WarningCycle.Status.WARNING_1_SENT,
            current_level=1,
            decision_state="DISTRACTED",
            decision_source="RULE_ONLY",
            decision_score=80,
            reason_codes=["BLACKLIST_HIGH"],
            domain="docs.example.com",
        )
        WarningEvent.objects.create(
            session_id=session.id,
            warning_cycle=cycle,
            browser_event=event,
            warning_level=1,
            warning_type=WarningEvent.WarningType.MANUAL,
            domain="docs.example.com",
        )
        AIAnalysisResult.objects.create(
            session_id=session.id,
            browser_event_id=event.id,
            provider="test",
            model_name="test-model",
            raw_response={"secret": "provider raw response"},
        )
        Notification.objects.create(
            user=self.user,
            notification_type=Notification.Type.TEST,
            title="Reminder",
            message="Study",
            dedupe_key="day26-export",
        )

        job, _created = create_or_reuse_account_export_job(self.user)
        result = AccountDataExportService().run(job.id)
        archive = self.read_zip(result)

        names = archive.namelist()
        self.assertIn("focusos-account-export/manifest.json", names)
        self.assertTrue(all(not name.startswith("/") and ".." not in name for name in names))
        manifest = json.loads(archive.read("focusos-account-export/manifest.json"))
        account = json.loads(archive.read("focusos-account-export/account.json"))
        sessions = json.loads(archive.read("focusos-account-export/sessions.json"))
        documents = json.loads(archive.read("focusos-account-export/documents.json"))
        flashcards = json.loads(archive.read("focusos-account-export/flashcards.json"))
        warning_cycles = json.loads(
            archive.read("focusos-account-export/warning_cycles.json")
        )
        ai = json.loads(archive.read("focusos-account-export/ai_insights.json"))
        payload = "\n".join(archive.read(name).decode("utf-8") for name in names)

        self.assertEqual(result.status, AccountDataExportJob.Status.COMPLETED)
        self.assertEqual(result.progress, 100)
        self.assertEqual(len(result.checksum), 64)
        self.assertEqual(manifest["binary_files_included"], False)
        self.assertEqual(account["email"], self.user.email)
        self.assertEqual(sessions[0]["goal"], "Export du lieu tieng Viet")
        self.assertEqual(documents[0]["id"], str(document.id))
        self.assertEqual(flashcards["cards"][0]["answer"], "Cau tra loi")
        self.assertEqual(warning_cycles[0]["id"], str(cycle.id))
        self.assertEqual(warning_cycles[0]["session_id"], str(session.id))
        self.assertEqual(warning_cycles[0]["domain"], "docs.example.com")
        self.assertEqual(ai["analysis_results"][0]["provider"], "test")
        self.assertNotIn("password", payload.lower())
        self.assertNotIn(self.user.password, payload)
        self.assertNotIn(str(self.tmp.name), payload)
        self.assertNotIn("provider raw response", payload)
        self.assertNotIn("Other user private goal", payload)
        self.assertNotIn(str(other_document.id), payload)

    def test_export_idempotency_and_cleanup(self):
        first, first_created = create_or_reuse_account_export_job(self.user)
        second, second_created = create_or_reuse_account_export_job(self.user)
        AccountDataExportService().run(first.id)
        AccountDataExportJob.objects.filter(pk=first.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        cleaned = cleanup_expired_account_exports()
        first.refresh_from_db()

        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first.id, second.id)
        self.assertEqual(cleaned, 1)
        self.assertEqual(first.status, AccountDataExportJob.Status.EXPIRED)
        self.assertFalse(first.file)


class AccountExportEndpointTests(Day26Base):
    def test_export_endpoint_creates_job_and_enqueues_after_commit(self):
        with patch("apps.users.views.generate_account_data_export_task.delay") as delay:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post("/api/account/export-data/", format="json")

        job = AccountDataExportJob.objects.get()
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["jobId"], str(job.id))
        self.assertEqual(response.data["status"], AccountDataExportJob.Status.PENDING)
        self.assertEqual(job.user, self.user)
        delay.assert_called_once_with(str(job.id))

    def test_repeated_export_endpoint_does_not_enqueue_duplicate_pending_job(self):
        with patch("apps.users.views.generate_account_data_export_task.delay") as delay:
            with self.captureOnCommitCallbacks(execute=True):
                first = self.client.post("/api/account/export-data/", format="json")
            with self.captureOnCommitCallbacks(execute=True):
                second = self.client.post("/api/account/export-data/", format="json")

        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["jobId"], second.data["jobId"])
        self.assertEqual(AccountDataExportJob.objects.count(), 1)
        delay.assert_called_once()


class AccountDeletionServiceTests(Day26Base):
    def create_auth_session(self, user):
        session = SessionStore()
        session["_auth_user_id"] = str(user.id)
        session["_auth_user_backend"] = "django.contrib.auth.backends.ModelBackend"
        session["_auth_user_hash"] = user.get_session_auth_hash()
        session.save()
        return session.session_key

    def test_deletion_requires_confirmed_job(self):
        job = AccountDeletionJob.objects.create(
            user=self.user,
            user_identifier_snapshot="snapshot",
            confirmed=False,
        )

        with self.assertRaises(AccountDeletionError):
            AccountDeletionService().run(job.id)

        job.refresh_from_db()
        self.assertEqual(job.status, AccountDeletionJob.Status.FAILED)
        self.assertEqual(job.error_code, "ACCOUNT_DELETION_NOT_CONFIRMED")
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_deletion_revokes_sessions_deletes_user_data_and_keeps_other_user(self):
        session = self.create_session()
        other_session = self.create_session(user=self.other_user, goal="Other remains")
        BrowserEvent.objects.create(
            session_id=session.id,
            event_type="url_change",
            url="https://delete.example.com",
        )
        event = BrowserEvent.objects.create(
            session_id=session.id,
            event_type="tab_switch",
            url="https://warn.example.com",
            domain="warn.example.com",
        )
        EventBatch.objects.create(session_id=session.id, batch_size=2)
        cycle = WarningCycle.objects.create(
            session_id=session.id,
            source_event=event,
            idempotency_key=f"delete-cycle:{session.id}",
            mode=session.mode,
            status=WarningCycle.Status.WARNING_1_SENT,
            current_level=1,
            decision_state="DISTRACTED",
            decision_source="RULE_ONLY",
            decision_score=75,
            reason_codes=["BLACKLIST_MEDIUM"],
            domain="warn.example.com",
        )
        WarningEvent.objects.create(
            session_id=session.id,
            warning_cycle=cycle,
            browser_event=event,
            warning_level=1,
            warning_type=WarningEvent.WarningType.NORMAL_BLACKLIST,
            decision_state="DISTRACTED",
            decision_source="RULE_ONLY",
            decision_score=75,
            domain="warn.example.com",
        )
        AIAnalysisResult.objects.create(
            session_id=session.id,
            browser_event_id=event.id,
            provider="test",
            model_name="test-model",
        )
        BrowserEvent.objects.create(
            session_id=other_session.id,
            event_type="url_change",
            url="https://other.example.com",
        )
        other_event = BrowserEvent.objects.create(
            session_id=other_session.id,
            event_type="tab_switch",
            url="https://other-warn.example.com",
        )
        EventBatch.objects.create(session_id=other_session.id, batch_size=1)
        other_cycle = WarningCycle.objects.create(
            session_id=other_session.id,
            source_event=other_event,
            idempotency_key=f"delete-cycle:{other_session.id}",
            mode=other_session.mode,
            status=WarningCycle.Status.WARNING_1_SENT,
            current_level=1,
            domain="other-warn.example.com",
        )
        WarningEvent.objects.create(
            session_id=other_session.id,
            warning_cycle=other_cycle,
            browser_event=other_event,
            warning_level=1,
            warning_type=WarningEvent.WarningType.NORMAL_BLACKLIST,
            domain="other-warn.example.com",
        )
        AIAnalysisResult.objects.create(
            session_id=other_session.id,
            browser_event_id=other_event.id,
            provider="other",
            model_name="other-model",
        )
        self.create_auth_session(self.user)
        self.create_auth_session(self.other_user)
        export_job = AccountDataExportJob.objects.create(user=self.user)
        export_job.file.save("user-export.zip", ContentFile(b"zip"), save=True)
        report_job = ReportExportJob.objects.create(user=self.user)
        report_job.file.save("report.pdf", ContentFile(b"%PDF"), save=True)
        export_name = export_job.file.name
        report_name = report_job.file.name
        job = AccountDeletionJob.objects.create(
            user=self.user,
            user_identifier_snapshot="snapshot",
            confirmed=True,
        )

        result = AccountDeletionService().run(job.id)

        self.assertEqual(result.status, AccountDeletionJob.Status.COMPLETED)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.other_user.pk).exists())
        self.assertFalse(FocusSession.objects.filter(pk=session.pk).exists())
        self.assertTrue(FocusSession.objects.filter(pk=other_session.pk).exists())
        self.assertFalse(BrowserEvent.objects.filter(session_id=session.id).exists())
        self.assertFalse(EventBatch.objects.filter(session_id=session.id).exists())
        self.assertFalse(WarningEvent.objects.filter(session_id=session.id).exists())
        self.assertFalse(WarningCycle.objects.filter(session_id=session.id).exists())
        self.assertFalse(AIAnalysisResult.objects.filter(session_id=session.id).exists())
        self.assertTrue(BrowserEvent.objects.filter(session_id=other_session.id).exists())
        self.assertTrue(EventBatch.objects.filter(session_id=other_session.id).exists())
        self.assertTrue(WarningEvent.objects.filter(session_id=other_session.id).exists())
        self.assertTrue(WarningCycle.objects.filter(session_id=other_session.id).exists())
        self.assertTrue(AIAnalysisResult.objects.filter(session_id=other_session.id).exists())
        self.assertGreaterEqual(result.audit_summary["deleted_counts"]["browser_events"], 2)
        self.assertEqual(result.audit_summary["deleted_counts"]["event_batches"], 1)
        self.assertEqual(result.audit_summary["deleted_counts"]["warning_events"], 1)
        self.assertEqual(result.audit_summary["deleted_counts"]["warning_cycles"], 1)
        self.assertEqual(result.audit_summary["deleted_counts"]["ai_analysis_results"], 1)
        self.assertEqual(Session.objects.count(), 1)
        self.assertNotIn("day26@example.com", json.dumps(result.audit_summary))
        self.assertFalse(export_job.file.storage.exists(export_name))
        self.assertFalse(report_job.file.storage.exists(report_name))


class AccountDeletionEndpointTests(Day26Base):
    def test_delete_endpoint_creates_confirmed_job_and_enqueues_after_commit(self):
        with patch("apps.users.views.delete_account_data_task.delay") as delay:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.delete(
                    "/api/account/delete/",
                    {"currentPassword": PASSWORD},
                    format="json",
                )

        job = AccountDeletionJob.objects.get()
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["jobId"], str(job.id))
        self.assertIn("statusToken", response.data)
        self.assertIn("statusExpiresAt", response.data)
        self.assertTrue(job.confirmed)
        self.assertEqual(job.user, self.user)
        self.assertEqual(
            job.status_token_hash,
            hash_deletion_status_token(response.data["statusToken"]),
        )
        self.assertNotEqual(job.status_token_hash, response.data["statusToken"])
        delay.assert_called_once_with(str(job.id))

    def test_delete_endpoint_rejects_wrong_password_without_job(self):
        response = self.client.delete(
            "/api/account/delete/",
            {"currentPassword": "wrong"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(AccountDeletionJob.objects.exists())

    def test_authenticated_owner_and_receipt_can_poll_before_deletion(self):
        with patch("apps.users.views.delete_account_data_task.delay"):
            with self.captureOnCommitCallbacks(execute=True):
                delete = self.client.delete(
                    "/api/account/delete/",
                    {"currentPassword": PASSWORD},
                    format="json",
                )
        job = AccountDeletionJob.objects.get()
        token = delete.data["statusToken"]

        self.client.force_authenticate(self.user)
        owner_detail = self.client.get(f"/api/account/delete/{job.id}/")
        owner_status = self.client.get(f"/api/account/delete/{job.id}/status/")
        receipt_status = APIClient().get(
            f"/api/account/delete/{job.id}/status/",
            HTTP_X_DELETION_STATUS_TOKEN=token,
        )

        self.assertEqual(owner_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(owner_status.status_code, status.HTTP_200_OK)
        self.assertEqual(receipt_status.status_code, status.HTTP_200_OK)
        self.assertEqual(receipt_status.data["jobId"], str(job.id))

    def test_another_user_missing_invalid_expired_and_cross_job_tokens_are_safe_404(self):
        job = AccountDeletionJob.objects.create(
            user=self.user,
            user_identifier_snapshot="snapshot",
            confirmed=True,
        )
        other_job = AccountDeletionJob.objects.create(
            user=self.other_user,
            user_identifier_snapshot="other-snapshot",
            confirmed=True,
        )
        token = rotate_deletion_status_token(job)
        other_client = APIClient()
        other_client.force_authenticate(self.other_user)

        owner_route = other_client.get(f"/api/account/delete/{job.id}/")
        status_no_token = other_client.get(f"/api/account/delete/{job.id}/status/")
        invalid = APIClient().get(
            f"/api/account/delete/{job.id}/status/",
            HTTP_X_DELETION_STATUS_TOKEN="not-the-token",
        )
        cross_job = APIClient().get(
            f"/api/account/delete/{other_job.id}/status/",
            HTTP_X_DELETION_STATUS_TOKEN=token,
        )
        AccountDeletionJob.objects.filter(pk=job.pk).update(
            status_token_expires_at=timezone.now() - timedelta(seconds=1)
        )
        expired = APIClient().get(
            f"/api/account/delete/{job.id}/status/",
            HTTP_X_DELETION_STATUS_TOKEN=token,
        )
        missing_job = APIClient().get(
            "/api/account/delete/00000000-0000-0000-0000-000000000000/status/",
            HTTP_X_DELETION_STATUS_TOKEN=token,
        )

        for response in [owner_route, status_no_token, invalid, cross_job, expired, missing_job]:
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
            self.assertIn("not found", str(response.data).lower())

    def test_token_rotation_invalidates_old_receipt(self):
        job = AccountDeletionJob.objects.create(
            user=self.user,
            user_identifier_snapshot="snapshot",
            confirmed=True,
        )
        old_token = rotate_deletion_status_token(job)
        job.refresh_from_db()
        new_token = rotate_deletion_status_token(job)

        old_response = APIClient().get(
            f"/api/account/delete/{job.id}/status/",
            HTTP_X_DELETION_STATUS_TOKEN=old_token,
        )
        new_response = APIClient().get(
            f"/api/account/delete/{job.id}/status/",
            HTTP_X_DELETION_STATUS_TOKEN=new_token,
        )

        self.assertEqual(old_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(new_response.status_code, status.HTTP_200_OK)

    def test_receipt_can_poll_after_user_deleted_and_payload_is_minimal(self):
        session = self.create_session()
        BrowserEvent.objects.create(
            session_id=session.id,
            event_type="url_change",
            url="https://delete.example.com",
        )
        job = AccountDeletionJob.objects.create(
            user=self.user,
            user_identifier_snapshot="snapshot",
            confirmed=True,
        )
        token = rotate_deletion_status_token(job)

        AccountDeletionService().run(job.id)
        response = APIClient().get(
            f"/api/account/delete/{job.id}/status/",
            HTTP_X_DELETION_STATUS_TOKEN=token,
        )
        job.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], AccountDeletionJob.Status.COMPLETED)
        self.assertIsNone(job.user_id)
        self.assertTrue(AccountDeletionJob.objects.filter(pk=job.pk).exists())
        self.assertEqual(
            set(response.data.keys()),
            {
                "jobId",
                "status",
                "createdAt",
                "startedAt",
                "completedAt",
                "statusExpiresAt",
                "errorCode",
                "errorMessage",
            },
        )
        payload = json.dumps(response.data, default=str)
        self.assertNotIn("day26@example.com", payload)
        self.assertNotIn("snapshot", payload)
        self.assertNotIn("audit", payload.lower())

    def test_failed_receipt_payload_does_not_expose_internal_error_text(self):
        job = AccountDeletionJob.objects.create(
            user=self.user,
            user_identifier_snapshot="snapshot",
            confirmed=True,
            status=AccountDeletionJob.Status.FAILED,
            error_code="DATABASE_TRACEBACK",
            error_message="Traceback: C:/secret/path celery args password=123",
            completed_at=timezone.now(),
        )
        token = rotate_deletion_status_token(job)

        response = APIClient().get(
            f"/api/account/delete/{job.id}/status/",
            HTTP_X_DELETION_STATUS_TOKEN=token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["errorCode"], "DATABASE_TRACEBACK")
        self.assertEqual(response.data["errorMessage"], "Account deletion failed.")
        payload = json.dumps(response.data)
        self.assertNotIn("Traceback", payload)
        self.assertNotIn("secret", payload)
        self.assertNotIn("celery", payload.lower())

    def test_repeated_deletion_task_execution_is_idempotent_and_keeps_receipt(self):
        job = AccountDeletionJob.objects.create(
            user=self.user,
            user_identifier_snapshot="snapshot",
            confirmed=True,
        )
        token = rotate_deletion_status_token(job)

        first = AccountDeletionService().run(job.id)
        second = AccountDeletionService().run(job.id)
        response = APIClient().get(
            f"/api/account/delete/{job.id}/status/",
            HTTP_X_DELETION_STATUS_TOKEN=token,
        )

        self.assertEqual(first.id, second.id)
        self.assertEqual(second.status, AccountDeletionJob.Status.COMPLETED)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_user_session_is_not_authenticated_after_successful_deletion(self):
        client = APIClient()
        self.assertTrue(client.login(email=self.user.email, password=PASSWORD))
        with patch("apps.users.views.delete_account_data_task.delay"):
            delete = client.delete(
                "/api/account/delete/",
                {"currentPassword": PASSWORD},
                format="json",
            )
        job = AccountDeletionJob.objects.get()

        AccountDeletionService().run(job.id)
        me = client.get("/api/auth/me/")
        receipt_status = client.get(
            f"/api/account/delete/{job.id}/status/",
            HTTP_X_DELETION_STATUS_TOKEN=delete.data["statusToken"],
        )

        self.assertEqual(delete.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn(me.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
        self.assertEqual(receipt_status.status_code, status.HTTP_200_OK)

    def test_cleanup_clears_expired_receipt_hash_without_deleting_job(self):
        job = AccountDeletionJob.objects.create(
            user=None,
            user_identifier_snapshot="snapshot",
            confirmed=True,
            status=AccountDeletionJob.Status.COMPLETED,
            completed_at=timezone.now(),
        )
        token = rotate_deletion_status_token(job)
        AccountDeletionJob.objects.filter(pk=job.pk).update(
            status_token_expires_at=timezone.now() - timedelta(seconds=1)
        )

        cleaned = cleanup_expired_account_deletion_receipts()
        job.refresh_from_db()
        response = APIClient().get(
            f"/api/account/delete/{job.id}/status/",
            HTTP_X_DELETION_STATUS_TOKEN=token,
        )

        self.assertEqual(cleaned, 1)
        self.assertEqual(job.status_token_hash, "")
        self.assertTrue(AccountDeletionJob.objects.filter(pk=job.pk).exists())
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

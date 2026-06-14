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
from rest_framework.test import APITestCase

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
from apps.tracking.models import BrowserEvent, WarningEvent

from .account_deletion import AccountDeletionError, AccountDeletionService
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
        WarningEvent.objects.create(
            session_id=session.id,
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
        BrowserEvent.objects.create(
            session_id=other_session.id,
            event_type="url_change",
            url="https://other.example.com",
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
        self.assertTrue(BrowserEvent.objects.filter(session_id=other_session.id).exists())
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
        self.assertTrue(job.confirmed)
        self.assertEqual(job.user, self.user)
        delay.assert_called_once_with(str(job.id))

    def test_delete_endpoint_rejects_wrong_password_without_job(self):
        response = self.client.delete(
            "/api/account/delete/",
            {"currentPassword": "wrong"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(AccountDeletionJob.objects.exists())

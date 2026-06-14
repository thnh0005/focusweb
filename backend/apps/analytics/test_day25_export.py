import json
import tempfile
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.ai.models import SessionInsight
from apps.sessions.models import FocusSession, SessionTag
from apps.tracking.models import BrowserEvent, WarningEvent

from .models import ReportExportJob
from .report_export import (
    StudyReportDataService,
    StudyReportExportService,
    StudyReportPDFRenderer,
    cleanup_expired_report_exports,
    create_or_reuse_pdf_export_job,
    generation_fingerprint,
    resolve_user_timezone,
)


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


class Day25ExportBase(APITestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.tmp.name)
        self.override.enable()
        self.user = User.objects.create_user(email="day25@example.com", password=PASSWORD)
        self.other_user = User.objects.create_user(
            email="day25-other@example.com",
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
            "goal": "Hoan thanh bao cao <script>alert(1)</script>",
            "status": FocusSession.Status.COMPLETED,
            "target_duration_seconds": 3600,
            "actual_duration_seconds": 1800,
            "focus_score": 80,
            "focus_state": "focused",
            "started_at": timezone.now() - timedelta(hours=2),
            "ended_at": timezone.now() - timedelta(hours=1, minutes=30),
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)


class Day25ReportDataBuilderTests(Day25ExportBase):
    def test_builds_user_scoped_report_without_raw_browser_fields(self):
        session = self.create_session()
        tag = SessionTag.objects.create(user=self.user, name="Backend")
        session.tags.add(tag)
        other_session = self.create_session(
            user=self.other_user,
            goal="Other user goal",
            actual_duration_seconds=7200,
            focus_score=10,
        )
        event = BrowserEvent.objects.create(
            session_id=session.id,
            event_type="url_change",
            url="https://private.example.com/path?token=secret",
            domain="www.private.example.com",
            page_title="Secret title",
            meta_description="Secret meta",
            content_snippet="Secret snippet",
            tab_switch_count=3,
        )
        WarningEvent.objects.create(
            session_id=session.id,
            browser_event=event,
            warning_level=1,
            warning_type=WarningEvent.WarningType.TAB_SWITCH,
            domain="www.private.example.com",
            url="https://private.example.com/path?token=secret",
            message="Secret warning",
        )
        WarningEvent.objects.create(
            session_id=other_session.id,
            warning_level=1,
            warning_type=WarningEvent.WarningType.MANUAL,
            domain="other.example.com",
        )
        SessionInsight.objects.create(
            session=session,
            status=SessionInsight.Status.COMPLETED,
            observations=["Use shorter breaks between backend sessions."],
            generated_at=timezone.now(),
        )
        tzinfo, timezone_name = resolve_user_timezone(self.user)
        report = StudyReportDataService(
            self.user,
            timezone.localdate() - timedelta(days=1),
            timezone.localdate(),
            tzinfo,
            timezone_name,
        ).build()

        self.assertEqual(report["summary"]["total_focus_minutes"], 30)
        self.assertEqual(report["summary"]["total_sessions"], 1)
        self.assertEqual(report["summary"]["average_focus_score"], 80)
        self.assertEqual(report["summary"]["total_warnings"], 1)
        self.assertEqual(report["mode_breakdown"][FocusSession.Mode.NORMAL]["session_count"], 1)
        self.assertEqual(report["distractions"]["top_domains"][0]["domain"], "private.example.com")
        self.assertEqual(report["sessions"][0]["tags"], ["Backend"])
        self.assertIn("Use shorter breaks", report["insights"][0])
        payload = json.dumps(report, ensure_ascii=False)
        self.assertNotIn("https://private.example.com/path", payload)
        self.assertNotIn("Secret title", payload)
        self.assertNotIn("Secret meta", payload)
        self.assertNotIn("Secret snippet", payload)
        self.assertNotIn("Other user goal", payload)

    def test_empty_period_builds_valid_zero_report(self):
        tzinfo, timezone_name = resolve_user_timezone(self.user)
        report = StudyReportDataService(
            self.user,
            timezone.localdate() - timedelta(days=1),
            timezone.localdate(),
            tzinfo,
            timezone_name,
        ).build()

        self.assertEqual(report["summary"]["total_focus_minutes"], 0)
        self.assertEqual(report["summary"]["total_sessions"], 0)
        self.assertTrue(report["metadata"]["empty_report"])


class Day25PDFRendererTests(Day25ExportBase):
    def test_renderer_returns_pdf_bytes_and_handles_unicode(self):
        report = {
            "title": "FocusOS Study Report",
            "user": {"display_name": "Nguyen Van A"},
            "period": {
                "date_from": "2026-06-01",
                "date_to": "2026-06-30",
                "timezone": "Asia/Ho_Chi_Minh",
            },
            "summary": {
                "total_focus_minutes": 90,
                "total_sessions": 2,
                "completed_sessions": 2,
                "average_focus_score": 85,
                "completion_rate": 100,
                "total_warnings": 0,
                "active_focus_days": 1,
                "best_focus_day": "2026-06-01",
            },
            "focus_trend": [{"date": "2026-06-01", "average_score": 85, "session_count": 2}],
            "mode_breakdown": {
                "normal": {"session_count": 1, "percentage": 50, "average_score": 80},
                "deep-work": {"session_count": 1, "percentage": 50, "average_score": 90},
            },
            "distractions": {
                "total_warnings": 0,
                "affected_session_count": 0,
                "average_tab_switches": 0,
                "auto_pause_count": 0,
                "top_domains": [],
            },
            "sessions": [
                {
                    "started_at": "2026-06-01T08:00:00+07:00",
                    "goal": "Hoan thanh API xuat PDF tieng Viet",
                    "mode": "normal",
                    "actual_duration_minutes": 45,
                    "status": "completed",
                    "focus_score": 85,
                    "warning_count": 0,
                }
            ],
            "insights": ["Nen giu lich hoc on dinh."],
            "generated_at": timezone.now().isoformat(),
        }

        pdf_bytes = StudyReportPDFRenderer().render(report)

        self.assertTrue(pdf_bytes.startswith(b"%PDF"))
        self.assertGreater(len(pdf_bytes), 1000)


class Day25ExportJobTests(Day25ExportBase):
    def test_fingerprint_is_stable_and_user_scoped(self):
        today = timezone.localdate()

        first = generation_fingerprint(self.user.id, today, today, ReportExportJob.Format.PDF)
        second = generation_fingerprint(self.user.id, today, today, ReportExportJob.Format.PDF)
        other = generation_fingerprint(
            self.other_user.id,
            today,
            today,
            ReportExportJob.Format.PDF,
        )

        self.assertEqual(first, second)
        self.assertNotEqual(first, other)

    def test_create_or_reuse_prevents_duplicate_pending_job(self):
        today = timezone.localdate()

        first, first_created = create_or_reuse_pdf_export_job(self.user, today, today)
        second, second_created = create_or_reuse_pdf_export_job(self.user, today, today)

        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first.id, second.id)
        self.assertEqual(ReportExportJob.objects.count(), 1)

    def test_export_service_completes_job_and_stores_pdf_metadata(self):
        self.create_session()
        today = timezone.localdate()
        job, _created = create_or_reuse_pdf_export_job(
            self.user,
            today - timedelta(days=1),
            today,
        )

        result = StudyReportExportService().run(job.id)

        self.assertEqual(result.status, ReportExportJob.Status.COMPLETED)
        self.assertEqual(result.progress, 100)
        self.assertTrue(result.file.name.endswith(".pdf"))
        self.assertGreater(result.file_size, 1000)
        self.assertEqual(len(result.checksum), 64)
        self.assertNotIn(str(self.tmp.name), result.download_url)

    def test_cleanup_expires_completed_file_only(self):
        self.create_session()
        today = timezone.localdate()
        job, _created = create_or_reuse_pdf_export_job(
            self.user,
            today - timedelta(days=1),
            today,
        )
        StudyReportExportService().run(job.id)
        ReportExportJob.objects.filter(pk=job.pk).update(expires_at=timezone.now() - timedelta(seconds=1))

        cleaned = cleanup_expired_report_exports()

        job.refresh_from_db()
        self.assertEqual(cleaned, 1)
        self.assertEqual(job.status, ReportExportJob.Status.EXPIRED)
        self.assertFalse(job.file)


class Day25ReportExportAPITests(Day25ExportBase):
    def test_pdf_post_requires_authentication_and_enqueues_after_commit(self):
        self.client.force_authenticate(user=None)
        anonymous = self.client.post(
            "/api/reports/export/",
            {"date_from": str(timezone.localdate()), "date_to": str(timezone.localdate()), "format": "pdf"},
            format="json",
        )
        self.client.force_authenticate(self.user)

        with patch("apps.analytics.views.generate_study_report_export_task.delay") as delay:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    "/api/reports/export/",
                    {
                        "date_from": str(timezone.localdate()),
                        "date_to": str(timezone.localdate()),
                        "format": "pdf",
                        "user_id": str(self.other_user.id),
                        "filename": "unsafe.pdf",
                    },
                    format="json",
                )

        job = ReportExportJob.objects.get()
        self.assertIn(
            anonymous.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], ReportExportJob.Status.PENDING)
        self.assertEqual(job.user, self.user)
        self.assertEqual(job.export_format, ReportExportJob.Format.PDF)
        self.assertFalse(job.file)
        delay.assert_called_once_with(str(job.id))

    def test_invalid_pdf_date_range_returns_stable_error_code(self):
        today = timezone.localdate()
        response = self.client.post(
            "/api/reports/export/",
            {
                "date_from": str(today),
                "date_to": str(today - timedelta(days=1)),
                "format": "pdf",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error_code"], "INVALID_REPORT_DATE_RANGE")

    def test_repeated_pdf_post_reuses_pending_job_and_other_user_cannot_view(self):
        today = timezone.localdate()
        payload = {"date_from": str(today), "date_to": str(today), "format": "pdf"}

        with patch("apps.analytics.views.generate_study_report_export_task.delay") as delay:
            with self.captureOnCommitCallbacks(execute=True):
                first = self.client.post("/api/reports/export/", payload, format="json")
            with self.captureOnCommitCallbacks(execute=True):
                second = self.client.post("/api/reports/export/", payload, format="json")

        job_id = first.data["jobId"]
        self.client.force_authenticate(self.other_user)
        other = self.client.get(f"/api/reports/export/{job_id}/")

        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["jobId"], second.data["jobId"])
        self.assertEqual(ReportExportJob.objects.count(), 1)
        self.assertEqual(other.status_code, status.HTTP_404_NOT_FOUND)
        delay.assert_called_once()

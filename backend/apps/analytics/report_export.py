import hashlib
import html
import json
import os
import re
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone as datetime_timezone
from io import BytesIO
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from apps.ai.models import SessionInsight
from apps.sessions.models import FocusSession
from apps.tracking.models import BrowserEvent, WarningEvent

from .models import ReportExportJob


REPORT_VERSION = "day25-v1"
MAX_REPORT_DAYS = 365
EXPORT_TTL_DAYS = 14
MAX_SESSION_ROWS = 500
MAX_TEXT_LENGTH = 180


class ReportExportError(Exception):
    code = "REPORT_EXPORT_FAILED"

    def __init__(self, message, code=None):
        super().__init__(message)
        if code:
            self.code = code


class ReportValidationError(ReportExportError):
    pass


def safe_text(value, max_length=MAX_TEXT_LENGTH):
    if value is None:
        return ""
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(value)).strip()
    text = html.escape(text, quote=False)
    if len(text) > max_length:
        return f"{text[: max_length - 1]}..."
    return text


def resolve_user_timezone(user):
    names = []
    for attr in ("timezone", "time_zone"):
        value = getattr(user, attr, "")
        if value:
            names.append(value)
    preferences = getattr(user, "preferences", None)
    if preferences:
        for attr in ("timezone", "time_zone"):
            value = getattr(preferences, attr, "")
            if value:
                names.append(value)
    names.append(getattr(settings, "TIME_ZONE", "UTC"))
    for name in names:
        try:
            return ZoneInfo(str(name)), str(name)
        except (ZoneInfoNotFoundError, ValueError):
            continue
    return ZoneInfo("UTC"), "UTC"


def date_bounds(date_from, date_to, tzinfo):
    start = timezone.make_aware(datetime.combine(date_from, time.min), tzinfo)
    end = timezone.make_aware(
        datetime.combine(date_to + timedelta(days=1), time.min),
        tzinfo,
    )
    return start.astimezone(datetime_timezone.utc), end.astimezone(datetime_timezone.utc)


def date_range_from_preset(range_name, tzinfo):
    today = timezone.localdate(timezone.now(), timezone=tzinfo)
    if range_name == "7d":
        return today - timedelta(days=6), today
    if range_name == "30d":
        return today - timedelta(days=29), today
    raise ReportValidationError(
        "Unsupported report range.",
        code="INVALID_REPORT_DATE_RANGE",
    )


def validate_report_dates(date_from, date_to):
    today = timezone.localdate()
    if date_from > date_to:
        raise ReportValidationError(
            "date_from must be before or equal to date_to.",
            code="INVALID_REPORT_DATE_RANGE",
        )
    if date_from > today or date_to > today:
        raise ReportValidationError(
            "Report date range cannot be in the future.",
            code="INVALID_REPORT_DATE_RANGE",
        )
    if (date_to - date_from).days + 1 > MAX_REPORT_DAYS:
        raise ReportValidationError(
            "Report date range is too large.",
            code="REPORT_RANGE_TOO_LARGE",
        )


def generation_fingerprint(user_id, date_from, date_to, export_format, version=REPORT_VERSION):
    payload = {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "format": export_format,
        "report_version": version,
        "user_id": str(user_id),
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def normalize_domain(value):
    if not value:
        return ""
    raw = str(value).strip().lower()
    if "://" in raw:
        raw = urlparse(raw).netloc
    raw = raw.split("/", maxsplit=1)[0].split("?", maxsplit=1)[0].strip(".")
    if raw.startswith("www."):
        raw = raw[4:]
    return raw[:255]


class StudyReportDataService:
    def __init__(self, user, date_from, date_to, tzinfo, timezone_name):
        self.user = user
        self.date_from = date_from
        self.date_to = date_to
        self.tzinfo = tzinfo
        self.timezone_name = timezone_name
        self.start_utc, self.end_utc = date_bounds(date_from, date_to, tzinfo)

    def build(self):
        sessions_qs = (
            FocusSession.objects.filter(
                user=self.user,
                started_at__gte=self.start_utc,
                started_at__lt=self.end_utc,
            )
            .prefetch_related("tags")
            .order_by("started_at")
        )
        sessions = list(sessions_qs[: MAX_SESSION_ROWS + 1])
        truncated = len(sessions) > MAX_SESSION_ROWS
        sessions = sessions[:MAX_SESSION_ROWS]
        session_ids = [session.id for session in sessions]
        warning_rows = self._warning_rows(session_ids)
        warning_counts = Counter(row["session_id"] for row in warning_rows)
        tab_switch_counts = self._tab_switch_counts(session_ids)

        summary = self._summary(sessions, warning_counts)
        report_sessions = [
            self._session_row(session, warning_counts, tab_switch_counts)
            for session in sessions
        ]
        return {
            "title": "FocusOS Study Report",
            "user": {
                "display_name": safe_text(
                    getattr(self.user, "display_name", "") or getattr(self.user, "email", ""),
                    120,
                ),
            },
            "period": {
                "date_from": self.date_from.isoformat(),
                "date_to": self.date_to.isoformat(),
                "timezone": self.timezone_name,
                "start_utc": self.start_utc.isoformat(),
                "end_utc": self.end_utc.isoformat(),
            },
            "summary": summary,
            "focus_trend": self._focus_trend(sessions),
            "mode_breakdown": self._mode_breakdown(sessions),
            "distractions": self._distractions(warning_rows, sessions, tab_switch_counts),
            "sessions": report_sessions,
            "sessions_truncated": truncated,
            "session_rows_included": len(report_sessions),
            "insights": self._insights(session_ids),
            "recommendations": [],
            "generated_at": timezone.now().isoformat(),
            "metadata": {
                "report_version": REPORT_VERSION,
                "empty_report": not sessions,
            },
        }

    def _summary(self, sessions, warning_counts):
        total = len(sessions)
        completed = [s for s in sessions if s.status == FocusSession.Status.COMPLETED]
        cancelled = [s for s in sessions if s.status == FocusSession.Status.CANCELLED]
        scored = [s.focus_score for s in completed if s.focus_score is not None]
        total_seconds = sum(s.actual_duration_seconds or 0 for s in completed)
        active_days = {
            timezone.localtime(s.started_at, self.tzinfo).date().isoformat()
            for s in sessions
        }
        day_seconds = defaultdict(int)
        for session in completed:
            day = timezone.localtime(session.started_at, self.tzinfo).date().isoformat()
            day_seconds[day] += session.actual_duration_seconds or 0
        best_focus_day = None
        if day_seconds:
            best_focus_day = max(day_seconds.items(), key=lambda item: (item[1], item[0]))[0]
        total_warnings = sum(warning_counts.values())
        return {
            "total_focus_minutes": total_seconds // 60,
            "total_focus_hours": round(total_seconds / 3600, 2),
            "total_sessions": total,
            "completed_sessions": len(completed),
            "cancelled_sessions": len(cancelled),
            "deep_work_sessions": len(
                [s for s in sessions if s.mode == FocusSession.Mode.DEEP_WORK]
            ),
            "normal_sessions": len([s for s in sessions if s.mode == FocusSession.Mode.NORMAL]),
            "average_focus_score": round(sum(scored) / len(scored), 2) if scored else None,
            "completion_rate": round(len(completed) / total * 100, 2) if total else 0,
            "total_warnings": total_warnings,
            "average_warnings_per_session": round(total_warnings / total, 2) if total else 0,
            "active_focus_days": len(active_days),
            "best_focus_day": best_focus_day,
        }

    def _session_row(self, session, warning_counts, tab_switch_counts):
        score = session.focus_score
        if score is None and hasattr(session, "score_result"):
            score = session.score_result.total_score
        return {
            "started_at": timezone.localtime(session.started_at, self.tzinfo).isoformat(),
            "ended_at": timezone.localtime(session.ended_at, self.tzinfo).isoformat()
            if session.ended_at
            else None,
            "goal": safe_text(session.goal),
            "mode": session.mode,
            "target_duration_minutes": (session.target_duration_seconds or 0) // 60,
            "actual_duration_minutes": (session.actual_duration_seconds or 0) // 60,
            "status": session.status,
            "focus_score": score,
            "focus_state_label": safe_text(session.focus_state, 64),
            "warning_count": warning_counts.get(session.id, 0),
            "tab_switch_count": tab_switch_counts.get(session.id, 0),
            "tags": [safe_text(tag.name, 50) for tag in session.tags.all()[:3]],
        }

    def _focus_trend(self, sessions):
        rows = {}
        for session in sessions:
            if session.status != FocusSession.Status.COMPLETED:
                continue
            day = timezone.localtime(session.started_at, self.tzinfo).date().isoformat()
            rows.setdefault(day, {"scores": [], "session_count": 0})
            rows[day]["session_count"] += 1
            if session.focus_score is not None:
                rows[day]["scores"].append(session.focus_score)
        trend = []
        for day in sorted(rows):
            scores = rows[day]["scores"]
            trend.append(
                {
                    "date": day,
                    "average_score": round(sum(scores) / len(scores), 2) if scores else None,
                    "session_count": rows[day]["session_count"],
                }
            )
        return trend

    def _mode_breakdown(self, sessions):
        total = len(sessions)
        breakdown = {}
        for mode in [FocusSession.Mode.NORMAL, FocusSession.Mode.DEEP_WORK]:
            mode_sessions = [s for s in sessions if s.mode == mode]
            scores = [
                s.focus_score
                for s in mode_sessions
                if s.status == FocusSession.Status.COMPLETED and s.focus_score is not None
            ]
            breakdown[mode] = {
                "session_count": len(mode_sessions),
                "percentage": round(len(mode_sessions) / total * 100, 2) if total else 0,
                "average_score": round(sum(scores) / len(scores), 2) if scores else None,
            }
        return breakdown

    def _warning_rows(self, session_ids):
        if not session_ids:
            return []
        return list(
            WarningEvent.objects.filter(session_id__in=session_ids)
            .values("session_id", "domain", "triggered_auto_pause")
            .order_by()
        )

    def _tab_switch_counts(self, session_ids):
        if not session_ids:
            return {}
        rows = (
            BrowserEvent.objects.filter(session_id__in=session_ids)
            .values("session_id")
            .annotate(total=Sum("tab_switch_count"))
        )
        return {row["session_id"]: row["total"] or 0 for row in rows}

    def _distractions(self, warning_rows, sessions, tab_switch_counts):
        domains = Counter()
        affected_sessions = set()
        auto_pause_count = 0
        for row in warning_rows:
            affected_sessions.add(row["session_id"])
            domain = normalize_domain(row["domain"])
            if domain:
                domains[domain] += 1
            if row["triggered_auto_pause"]:
                auto_pause_count += 1
        return {
            "total_warnings": len(warning_rows),
            "affected_session_count": len(affected_sessions),
            "average_tab_switches": round(sum(tab_switch_counts.values()) / len(sessions), 2)
            if sessions
            else 0,
            "auto_pause_count": auto_pause_count,
            "top_domains": [
                {"domain": domain, "warning_count": count}
                for domain, count in domains.most_common(5)
            ],
        }

    def _insights(self, session_ids):
        if not session_ids:
            return []
        rows = (
            SessionInsight.objects.filter(
                session_id__in=session_ids,
                status=SessionInsight.Status.COMPLETED,
            )
            .order_by("-generated_at", "-created_at")
            .values("observations")[:5]
        )
        insights = []
        for row in rows:
            for observation in row["observations"] or []:
                insights.append(safe_text(observation, 240))
                if len(insights) >= 5:
                    return insights
        return insights


class StudyReportPDFRenderer:
    def __init__(self):
        self.font_name = self._register_font()

    def render(self, report_data):
        buffer = BytesIO()
        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=16 * mm,
            leftMargin=16 * mm,
            topMargin=16 * mm,
            bottomMargin=16 * mm,
            title=report_data["title"],
        )
        story = self._story(report_data)
        document.build(story, onFirstPage=self._footer, onLaterPages=self._footer)
        return buffer.getvalue()

    def _register_font(self):
        candidates = [
            os.getenv("REPORT_PDF_FONT_PATH", ""),
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/segoeui.ttf",
        ]
        for path in candidates:
            if path and os.path.exists(path):
                pdfmetrics.registerFont(TTFont("FocusOSUnicode", path))
                return "FocusOSUnicode"
        return "Helvetica"

    def _styles(self):
        styles = getSampleStyleSheet()
        for style in styles.byName.values():
            style.fontName = self.font_name
        styles["Title"].alignment = TA_CENTER
        styles.add(
            ParagraphStyle(
                name="Small",
                parent=styles["BodyText"],
                fontName=self.font_name,
                fontSize=8,
                leading=10,
            )
        )
        return styles

    def _story(self, data):
        styles = self._styles()
        story = [
            Paragraph(data["title"], styles["Title"]),
            Spacer(1, 8),
            Paragraph(
                f"{data['period']['date_from']} to {data['period']['date_to']} "
                f"({data['period']['timezone']})",
                styles["BodyText"],
            ),
            Paragraph(f"Generated at: {data['generated_at']}", styles["Small"]),
            Spacer(1, 10),
            self._summary_table(data["summary"]),
            Spacer(1, 10),
        ]
        story.extend(self._section("Focus Score Trend", self._trend_table(data["focus_trend"])))
        story.extend(self._section("Mode Breakdown", self._mode_table(data["mode_breakdown"])))
        story.extend(
            self._section("Distraction Summary", self._distraction_table(data["distractions"]))
        )
        story.append(PageBreak())
        story.extend(self._section("Session History", self._sessions_table(data["sessions"])))
        story.extend(
            self._section(
                "Insights and Recommendations",
                self._list_table(data["insights"], "No saved insights for this period."),
            )
        )
        return story

    def _section(self, title, table):
        styles = self._styles()
        return [Paragraph(title, styles["Heading2"]), Spacer(1, 4), table, Spacer(1, 10)]

    def _table(self, rows, widths=None):
        table = Table(rows, colWidths=widths, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2f7")),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("FONTNAME", (0, 0), (-1, -1), self.font_name),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("LEADING", (0, 0), (-1, -1), 10),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        return table

    def _summary_table(self, summary):
        rows = [["Metric", "Value"]]
        for key in [
            "total_focus_minutes",
            "total_sessions",
            "completed_sessions",
            "average_focus_score",
            "completion_rate",
            "total_warnings",
            "active_focus_days",
            "best_focus_day",
        ]:
            rows.append([key.replace("_", " ").title(), summary.get(key)])
        return self._table(rows, [85 * mm, 80 * mm])

    def _trend_table(self, trend):
        rows = [["Date", "Average score", "Sessions"]]
        rows.extend(
            [[row["date"], row["average_score"], row["session_count"]] for row in trend]
        )
        if len(rows) == 1:
            rows.append(["No scored sessions", "", ""])
        return self._table(rows, [55 * mm, 55 * mm, 45 * mm])

    def _mode_table(self, breakdown):
        rows = [["Mode", "Sessions", "Percentage", "Average score"]]
        for mode, data in breakdown.items():
            rows.append(
                [
                    mode,
                    data["session_count"],
                    data["percentage"],
                    data["average_score"],
                ]
            )
        return self._table(rows, [45 * mm, 35 * mm, 40 * mm, 45 * mm])

    def _distraction_table(self, distractions):
        rows = [
            ["Metric", "Value"],
            ["Total warnings", distractions["total_warnings"]],
            ["Affected sessions", distractions["affected_session_count"]],
            ["Average tab switches", distractions["average_tab_switches"]],
            ["Auto pauses", distractions["auto_pause_count"]],
            [
                "Top domains",
                ", ".join(
                    f"{row['domain']} ({row['warning_count']})"
                    for row in distractions["top_domains"]
                )
                or "None",
            ],
        ]
        return self._table(rows, [65 * mm, 100 * mm])

    def _sessions_table(self, sessions):
        rows = [["Started", "Goal", "Mode", "Minutes", "Status", "Score", "Warnings"]]
        for session in sessions:
            rows.append(
                [
                    session["started_at"][:16].replace("T", " "),
                    Paragraph(session["goal"] or "(No goal)", self._styles()["Small"]),
                    session["mode"],
                    session["actual_duration_minutes"],
                    session["status"],
                    session["focus_score"],
                    session["warning_count"],
                ]
            )
        if len(rows) == 1:
            rows.append(["No focus sessions in this period.", "", "", "", "", "", ""])
        return self._table(rows, [31 * mm, 55 * mm, 23 * mm, 18 * mm, 24 * mm, 15 * mm, 18 * mm])

    def _list_table(self, values, empty):
        rows = [["Saved insight"]]
        rows.extend([[Paragraph(value, self._styles()["BodyText"])] for value in values])
        if len(rows) == 1:
            rows.append([empty])
        return self._table(rows, [165 * mm])

    def _footer(self, canvas, document):
        canvas.saveState()
        canvas.setFont(self.font_name, 8)
        canvas.drawRightString(195 * mm, 10 * mm, f"Page {document.page}")
        canvas.restoreState()


class StudyReportExportService:
    def __init__(self, renderer=None, data_service_class=StudyReportDataService):
        self.renderer = renderer or StudyReportPDFRenderer()
        self.data_service_class = data_service_class

    def run(self, job_id):
        with transaction.atomic():
            job = ReportExportJob.objects.select_for_update().select_related("user").get(pk=job_id)
            if job.status in [ReportExportJob.Status.COMPLETED, ReportExportJob.Status.READY]:
                return job
            job.status = ReportExportJob.Status.PROCESSING
            job.started_at = timezone.now()
            job.progress = max(job.progress, 20)
            job.error_code = ""
            job.error_message = ""
            job.save(
                update_fields=[
                    "status",
                    "started_at",
                    "progress",
                    "error_code",
                    "error_message",
                    "updated_at",
                ]
            )

        try:
            tzinfo, timezone_name = resolve_user_timezone(job.user)
            data = self.data_service_class(
                job.user,
                job.date_from,
                job.date_to,
                tzinfo,
                timezone_name,
            ).build()
            self._update_progress(job.pk, 60)
            pdf_bytes = self.renderer.render(data)
            if not pdf_bytes.startswith(b"%PDF"):
                raise ReportExportError("PDF renderer returned invalid output.", "PDF_RENDER_FAILED")
            self._update_progress(job.pk, 90)
            return self._store_completed(job.pk, pdf_bytes, data)
        except ReportExportError as exc:
            self._fail(job.pk, exc.code, str(exc))
            raise
        except Exception as exc:
            self._fail(job.pk, "REPORT_EXPORT_FAILED", "Report export failed.")
            raise ReportExportError("Report export failed.") from exc

    def _update_progress(self, job_id, progress):
        ReportExportJob.objects.filter(pk=job_id).update(
            progress=progress,
            updated_at=timezone.now(),
        )

    def _store_completed(self, job_id, pdf_bytes, payload):
        digest = hashlib.sha256(pdf_bytes).hexdigest()
        with transaction.atomic():
            job = ReportExportJob.objects.select_for_update().get(pk=job_id)
            if job.file:
                job.file.delete(save=False)
            name = (
                f"user-{job.user_id}/job-{job.id}/"
                f"study-report-{job.date_from}-{job.date_to}.pdf"
            )
            job.file.save(name, ContentFile(pdf_bytes), save=False)
            job.file_size = len(pdf_bytes)
            job.checksum = digest
            job.payload = payload
            job.download_url = job.file.url if hasattr(job.file, "url") else ""
            job.status = ReportExportJob.Status.COMPLETED
            job.progress = 100
            job.completed_at = timezone.now()
            job.expires_at = job.completed_at + timedelta(days=EXPORT_TTL_DAYS)
            job.error_code = ""
            job.error_message = ""
            job.save()
            return job

    def _fail(self, job_id, code, message):
        safe_message = safe_text(message, 255)
        with transaction.atomic():
            job = ReportExportJob.objects.select_for_update().get(pk=job_id)
            if job.file:
                job.file.delete(save=False)
                job.file = ""
            job.status = ReportExportJob.Status.FAILED
            job.error_code = code
            job.error_message = safe_message
            job.completed_at = timezone.now()
            job.save()


def create_or_reuse_pdf_export_job(user, date_from, date_to):
    tzinfo, timezone_name = resolve_user_timezone(user)
    validate_report_dates(date_from, date_to)
    fingerprint = generation_fingerprint(
        user.id,
        date_from,
        date_to,
        ReportExportJob.Format.PDF,
    )
    now = timezone.now()
    with transaction.atomic():
        job = (
            ReportExportJob.objects.select_for_update()
            .filter(user=user, generation_fingerprint=fingerprint)
            .first()
        )
        if job and job.status in [
            ReportExportJob.Status.PENDING,
            ReportExportJob.Status.PROCESSING,
            ReportExportJob.Status.COMPLETED,
        ]:
            if job.status != ReportExportJob.Status.COMPLETED or not job.expires_at or job.expires_at > now:
                return job, False
        if job:
            if job.file:
                job.file.delete(save=False)
            job.status = ReportExportJob.Status.PENDING
            job.export_format = ReportExportJob.Format.PDF
            job.date_range = "custom"
            job.date_from = date_from
            job.date_to = date_to
            job.requested_timezone = timezone_name
            job.file = ""
            job.file_size = 0
            job.checksum = ""
            job.payload = {}
            job.download_url = ""
            job.progress = 0
            job.error_code = ""
            job.error_message = ""
            job.started_at = None
            job.completed_at = None
            job.expires_at = None
            job.report_version = REPORT_VERSION
            job.save()
            return job, True
        job = ReportExportJob.objects.create(
            user=user,
            status=ReportExportJob.Status.PENDING,
            export_format=ReportExportJob.Format.PDF,
            date_range="custom",
            date_from=date_from,
            date_to=date_to,
            requested_timezone=timezone_name,
            report_version=REPORT_VERSION,
            progress=0,
            generation_fingerprint=fingerprint,
        )
    return job, True


def cleanup_expired_report_exports(now=None):
    now = now or timezone.now()
    expired = ReportExportJob.objects.filter(
        status=ReportExportJob.Status.COMPLETED,
        expires_at__lte=now,
    )
    count = 0
    for job in expired.iterator():
        if job.file:
            job.file.delete(save=False)
        job.file = ""
        job.download_url = ""
        job.status = ReportExportJob.Status.EXPIRED
        job.save(update_fields=["file", "download_url", "status", "updated_at"])
        count += 1
    return count

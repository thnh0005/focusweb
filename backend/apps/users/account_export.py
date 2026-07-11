import hashlib
import json
import tempfile
import zipfile
from datetime import date, datetime, timedelta

from django.core.files import File
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.ai.models import (
    AIAnalysisResult,
    DocumentSummary,
    Flashcard,
    FlashcardDeck,
    FlashcardReviewSession,
    SessionInsight,
    StudyDocument,
)
from apps.analytics.models import ReportExportJob
from apps.extension.models import BlacklistEntry, ExtensionHeartbeat
from apps.notifications.models import Notification
from apps.scoring.models import FocusScore
from apps.sessions.models import FocusSession, GoalTemplate, SessionTag
from apps.tracking.models import BrowserEvent, WarningCycle, WarningEvent

from .models import AccountDataExportJob


EXPORT_VERSION = "day26-v1"
EXPORT_TTL_DAYS = 7


class AccountExportError(Exception):
    code = "ACCOUNT_EXPORT_FAILED"

    def __init__(self, message, code=None):
        super().__init__(message)
        if code:
            self.code = code


def json_default(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def dump_json(value):
    return json.dumps(
        value,
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
        default=json_default,
    ).encode("utf-8")


def safe_error(message):
    return str(message or "Account export failed.")[:255]


def latest_user_data_timestamp(user):
    timestamps = [user.updated_at]
    for model, filters, field in [
        (FocusSession, {"user": user}, "updated_at"),
        (SessionTag, {"user": user}, "created_at"),
        (GoalTemplate, {"user": user}, "updated_at"),
        (FocusScore, {"user": user}, "calculated_at"),
        (StudyDocument, {"user": user}, "processed_at"),
        (FlashcardDeck, {"user": user}, "updated_at"),
        (FlashcardReviewSession, {"user": user}, "started_at"),
        (Notification, {"user": user}, "created_at"),
        (BlacklistEntry, {"user": user}, "updated_at"),
        (ReportExportJob, {"user": user}, "updated_at"),
    ]:
        value = model.objects.filter(**filters).aggregate(latest=Max(field))["latest"]
        if value:
            timestamps.append(value)
    session_ids = list(FocusSession.objects.filter(user=user).values_list("id", flat=True))
    warning_cycle_latest = WarningCycle.objects.filter(
        session_id__in=session_ids
    ).aggregate(latest=Max("updated_at"))["latest"]
    if warning_cycle_latest:
        timestamps.append(warning_cycle_latest)
    return max(timestamps).isoformat()


def account_export_fingerprint(user):
    payload = {
        "export_version": EXPORT_VERSION,
        "latest": latest_user_data_timestamp(user),
        "user_id": str(user.id),
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class AccountDataExportBuilder:
    def __init__(self, user):
        self.user = user
        self.session_ids = list(
            FocusSession.objects.filter(user=user).values_list("id", flat=True)
        )
        self.document_ids = list(
            StudyDocument.objects.filter(user=user).values_list("id", flat=True)
        )

    def build_sections(self):
        return {
            "account.json": self.account(),
            "preferences.json": self.preferences(),
            "onboarding.json": self.onboarding(),
            "goal_templates.json": self.goal_templates(),
            "sessions.json": self.sessions(),
            "scores.json": self.scores(),
            "warnings.json": self.warnings(),
            "warning_cycles.json": self.warning_cycles(),
            "browser_events.json": self.browser_events(),
            "blacklist.json": self.blacklist(),
            "extension.json": self.extension(),
            "notifications.json": self.notifications(),
            "documents.json": self.documents(),
            "summaries.json": self.summaries(),
            "flashcards.json": self.flashcards(),
            "reports.json": self.reports(),
            "ai_insights.json": self.ai_insights(),
        }

    def account(self):
        return {
            "id": str(self.user.id),
            "email": self.user.email,
            "display_name": self.user.display_name,
            "avatar_url": self.user.avatar_url,
            "onboarding_complete": self.user.onboarding_complete,
            "is_email_verified": self.user.is_email_verified,
            "created_at": self.user.created_at,
            "updated_at": self.user.updated_at,
        }

    def preferences(self):
        preferences = getattr(self.user, "preferences", None)
        if not preferences:
            return {}
        return {
            "default_mode": preferences.default_mode,
            "default_duration_minutes": preferences.default_duration_minutes,
            "theme": preferences.theme,
            "ambient_effect": preferences.ambient_effect,
            "notifications_enabled": preferences.notifications_enabled,
            "session_reminder_enabled": preferences.session_reminder_enabled,
            "session_reminder_time": preferences.session_reminder_time,
            "weekly_summary_enabled": preferences.weekly_summary_enabled,
            "deep_work_suggestion_enabled": preferences.deep_work_suggestion_enabled,
            "sound_enabled": preferences.sound_enabled,
            "ambient_sound_volume": preferences.ambient_sound_volume,
            "music_enabled": preferences.music_enabled,
            "music_track": preferences.music_track,
            "music_autoplay": preferences.music_autoplay,
            "use_custom_playlist": preferences.use_custom_playlist,
            "custom_playlist_url": preferences.custom_playlist_url,
            "custom_playlist_provider": preferences.custom_playlist_provider,
            "ambient_effect_enabled": preferences.ambient_effect_enabled,
            "ambient_effect_intensity": preferences.ambient_effect_intensity,
            "theme_accent": preferences.theme_accent,
            "workspace_background_url": preferences.workspace_background_url,
            "auto_resume_session": preferences.auto_resume_session,
            "extension_installed": preferences.extension_installed,
            "created_at": preferences.created_at,
            "updated_at": preferences.updated_at,
        }

    def onboarding(self):
        survey = getattr(self.user, "onboarding_survey", None)
        profile = getattr(self.user, "profile", None)
        return {
            "profile": {
                "profession": getattr(profile, "profession", ""),
                "learning_domain": getattr(profile, "learning_domain", []),
                "streak_count": getattr(profile, "streak_count", 0),
                "total_sessions": getattr(profile, "total_sessions", 0),
                "total_focus_minutes": getattr(profile, "total_focus_minutes", 0),
            },
            "survey": {
                "profession": getattr(survey, "profession", ""),
                "learning_domain": getattr(survey, "learning_domain", []),
                "preferred_duration_minutes": getattr(
                    survey,
                    "preferred_duration_minutes",
                    None,
                ),
                "extension_installed": getattr(survey, "extension_installed", False),
                "skipped": getattr(survey, "skipped", False),
                "completed_at": getattr(survey, "completed_at", None),
            },
        }

    def goal_templates(self):
        return [
            {
                "id": template.id,
                "label": template.label,
                "text": template.text,
                "usage_count": template.usage_count,
                "last_used_at": template.last_used_at,
                "created_at": template.created_at,
                "updated_at": template.updated_at,
            }
            for template in GoalTemplate.objects.filter(user=self.user).iterator()
        ]

    def sessions(self):
        rows = []
        queryset = (
            FocusSession.objects.filter(user=self.user)
            .prefetch_related("tags")
            .order_by("started_at")
        )
        for session in queryset.iterator(chunk_size=200):
            rows.append(
                {
                    "id": str(session.id),
                    "name": session.name,
                    "mode": session.mode,
                    "goal": session.goal,
                    "target_duration_seconds": session.target_duration_seconds,
                    "actual_duration_seconds": session.actual_duration_seconds,
                    "focus_score": session.focus_score,
                    "focus_state": session.focus_state,
                    "status": session.status,
                    "started_at": session.started_at,
                    "ended_at": session.ended_at,
                    "tags": [tag.name for tag in session.tags.all()],
                    "note": getattr(getattr(session, "note", None), "content", ""),
                }
            )
        return rows

    def scores(self):
        rows = []
        for score in (
            FocusScore.objects.filter(user=self.user)
            .select_related("session")
            .prefetch_related("components")
            .iterator(chunk_size=200)
        ):
            rows.append(
                {
                    "id": str(score.id),
                    "session_id": str(score.session_id),
                    "total_score": score.total_score,
                    "focus_state": score.focus_state,
                    "source": score.source,
                    "metadata": score.metadata,
                    "calculated_at": score.calculated_at,
                    "components": [
                        {
                            "key": component.key,
                            "label": component.label,
                            "value": component.value,
                            "weight": component.weight,
                            "metadata": component.metadata,
                        }
                        for component in score.components.all()
                    ],
                }
            )
        return rows

    def warnings(self):
        return [
            {
                "id": str(warning.id),
                "session_id": str(warning.session_id),
                "warning_level": warning.warning_level,
                "warning_type": warning.warning_type,
                "decision_state": warning.decision_state,
                "decision_source": warning.decision_source,
                "decision_score": warning.decision_score,
                "reason_codes": warning.reason_codes,
                "domain": warning.domain,
                "url": warning.url,
                "message": warning.message,
                "was_acknowledged": warning.was_acknowledged,
                "auto_pause_required": warning.auto_pause_required,
                "triggered_auto_pause": warning.triggered_auto_pause,
                "created_at": warning.created_at,
            }
            for warning in WarningEvent.objects.filter(session_id__in=self.session_ids).iterator()
        ]

    def warning_cycles(self):
        return [
            {
                "id": str(cycle.id),
                "session_id": str(cycle.session_id),
                "source_event_id": str(cycle.source_event_id)
                if cycle.source_event_id
                else None,
                "idempotency_key": cycle.idempotency_key,
                "mode": cycle.mode,
                "status": cycle.status,
                "current_level": cycle.current_level,
                "decision_state": cycle.decision_state,
                "decision_source": cycle.decision_source,
                "decision_score": cycle.decision_score,
                "reason_codes": cycle.reason_codes,
                "domain": cycle.domain,
                "auto_pause_required": cycle.auto_pause_required,
                "action": cycle.action,
                "next_warning_at": cycle.next_warning_at,
                "started_at": cycle.started_at,
                "resolved_at": cycle.resolved_at,
                "updated_at": cycle.updated_at,
            }
            for cycle in WarningCycle.objects.filter(
                session_id__in=self.session_ids
            ).iterator()
        ]

    def browser_events(self):
        return [
            {
                "id": str(event.id),
                "session_id": str(event.session_id),
                "event_type": event.event_type,
                "url": event.url,
                "domain": event.domain,
                "page_title": event.page_title,
                "meta_description": event.meta_description,
                "content_snippet": event.content_snippet,
                "active_seconds": event.active_seconds,
                "idle_seconds": event.idle_seconds,
                "tab_switch_count": event.tab_switch_count,
                "created_at": event.created_at,
            }
            for event in BrowserEvent.objects.filter(session_id__in=self.session_ids).iterator()
        ]

    def blacklist(self):
        return [
            {
                "id": str(entry.id),
                "domain": entry.domain,
                "severity": entry.severity,
                "created_at": entry.created_at,
                "updated_at": entry.updated_at,
            }
            for entry in BlacklistEntry.objects.filter(user=self.user).iterator()
        ]

    def extension(self):
        return [
            {
                "id": str(heartbeat.id),
                "extension_version": heartbeat.extension_version,
                "browser": heartbeat.browser,
                "is_active": heartbeat.is_active,
                "last_seen": heartbeat.last_seen,
                "created_at": heartbeat.created_at,
            }
            for heartbeat in ExtensionHeartbeat.objects.filter(user_id=self.user.id).iterator()
        ]

    def notifications(self):
        return [
            {
                "id": str(notification.id),
                "notification_type": notification.notification_type,
                "title": notification.title,
                "message": notification.message,
                "status": notification.status,
                "scheduled_for": notification.scheduled_for,
                "metadata": notification.metadata,
                "read_at": notification.read_at,
                "delivered_at": notification.delivered_at,
                "created_at": notification.created_at,
            }
            for notification in Notification.objects.filter(user=self.user).iterator()
        ]

    def documents(self):
        return [
            {
                "id": str(document.id),
                "filename": document.filename,
                "original_name": document.original_name,
                "file_type": document.file_type,
                "file_size_bytes": document.file_size_bytes,
                "page_count": document.page_count,
                "extracted_text": document.extracted_text,
                "status": document.status,
                "metadata": document.metadata,
                "uploaded_at": document.uploaded_at,
                "processed_at": document.processed_at,
            }
            for document in StudyDocument.objects.filter(user=self.user).iterator()
        ]

    def summaries(self):
        return [
            {
                "id": str(summary.id),
                "document_id": str(summary.document_id),
                "mode": summary.mode,
                "status": summary.status,
                "content": summary.content,
                "structured_content": summary.structured_content,
                "input_checksum": summary.input_checksum,
                "model_name": summary.model_name,
                "provider": summary.provider,
                "prompt_version": summary.prompt_version,
                "source": summary.source,
                "generated_at": summary.generated_at,
                "created_at": summary.created_at,
                "updated_at": summary.updated_at,
            }
            for summary in DocumentSummary.objects.filter(
                document_id__in=self.document_ids
            ).iterator()
        ]

    def flashcards(self):
        deck_ids = list(
            FlashcardDeck.objects.filter(user=self.user).values_list("id", flat=True)
        )
        return {
            "decks": [
                {
                    "id": str(deck.id),
                    "document_id": str(deck.document_id),
                    "title": deck.title,
                    "quantity": deck.quantity,
                    "requested_quantity": deck.requested_quantity,
                    "generated_quantity": deck.generated_quantity,
                    "difficulty": deck.difficulty,
                    "status": deck.status,
                    "page_range": deck.page_range,
                    "scope": deck.scope,
                    "source_checksum": deck.source_checksum,
                    "generation_fingerprint": deck.generation_fingerprint,
                    "model_name": deck.model_name,
                    "provider": deck.provider,
                    "prompt_version": deck.prompt_version,
                    "generated_at": deck.generated_at,
                    "updated_at": deck.updated_at,
                }
                for deck in FlashcardDeck.objects.filter(user=self.user).iterator()
            ],
            "cards": [
                {
                    "id": str(card.id),
                    "deck_id": str(card.deck_id),
                    "document_id": str(card.document_id),
                    "question": card.question,
                    "answer": card.answer,
                    "difficulty": card.difficulty,
                    "page_reference": card.page_reference,
                    "order": card.order,
                    "created_at": card.created_at,
                }
                for card in Flashcard.objects.filter(deck_id__in=deck_ids).iterator()
            ],
            "review_sessions": [
                {
                    "id": str(review.id),
                    "deck_id": str(review.deck_id),
                    "total_cards": review.total_cards,
                    "reviewed_count": review.reviewed_count,
                    "correct_count": review.correct_count,
                    "metadata": review.metadata,
                    "started_at": review.started_at,
                    "completed_at": review.completed_at,
                }
                for review in FlashcardReviewSession.objects.filter(
                    user=self.user
                ).iterator()
            ],
        }

    def reports(self):
        return [
            {
                "id": str(job.id),
                "status": job.status,
                "format": job.export_format,
                "date_range": job.date_range,
                "date_from": job.date_from,
                "date_to": job.date_to,
                "file_size": job.file_size,
                "checksum": job.checksum,
                "report_version": job.report_version,
                "requested_at": job.requested_at,
                "completed_at": job.completed_at,
                "expires_at": job.expires_at,
            }
            for job in ReportExportJob.objects.filter(user=self.user).iterator()
        ]

    def ai_insights(self):
        return {
            "session_insights": [
                {
                    "id": str(insight.id),
                    "session_id": str(insight.session_id),
                    "status": insight.status,
                    "observations": insight.observations,
                    "source": insight.source,
                    "model_name": insight.model_name,
                    "generated_at": insight.generated_at,
                    "created_at": insight.created_at,
                    "updated_at": insight.updated_at,
                }
                for insight in SessionInsight.objects.filter(
                    session_id__in=self.session_ids
                ).iterator()
            ],
            "analysis_results": [
                {
                    "id": str(result.id),
                    "session_id": str(result.session_id),
                    "browser_event_id": str(result.browser_event_id)
                    if result.browser_event_id
                    else None,
                    "provider": result.provider,
                    "model_name": result.model_name,
                    "domain": result.domain,
                    "relevance_score": result.relevance_score,
                    "is_relevant": result.is_relevant,
                    "focus_state": result.focus_state,
                    "reason": result.reason,
                    "latency_ms": result.latency_ms,
                    "created_at": result.created_at,
                }
                for result in AIAnalysisResult.objects.filter(
                    session_id__in=self.session_ids
                ).iterator()
            ],
        }


class AccountArchiveWriter:
    root = "focusos-account-export"

    def write(self, user, sections, fileobj):
        manifest_sections = []
        with zipfile.ZipFile(fileobj, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for filename, payload in sections.items():
                count = self.record_count(payload)
                archive.writestr(f"{self.root}/{filename}", dump_json(payload))
                manifest_sections.append(
                    {"name": filename.removesuffix(".json"), "file": filename, "record_count": count}
                )
            manifest = {
                "export_version": EXPORT_VERSION,
                "generated_at": timezone.now(),
                "user_id": str(user.id),
                "format": "zip+json",
                "binary_files_included": False,
                "sections": manifest_sections,
            }
            archive.writestr(f"{self.root}/manifest.json", dump_json(manifest))
        fileobj.seek(0)

    def record_count(self, payload):
        if isinstance(payload, list):
            return len(payload)
        if isinstance(payload, dict):
            if all(isinstance(value, list) for value in payload.values()):
                return sum(len(value) for value in payload.values())
            return 1 if payload else 0
        return 0


class AccountDataExportService:
    def __init__(self, builder_class=AccountDataExportBuilder, writer=None):
        self.builder_class = builder_class
        self.writer = writer or AccountArchiveWriter()

    def run(self, job_id):
        with transaction.atomic():
            job = (
                AccountDataExportJob.objects.select_for_update()
                .select_related("user")
                .get(pk=job_id)
            )
            if job.status == AccountDataExportJob.Status.COMPLETED:
                return job
            if job.status == AccountDataExportJob.Status.CANCELLED:
                return job
            job.status = AccountDataExportJob.Status.PROCESSING
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
            sections = self.builder_class(job.user).build_sections()
            AccountDataExportJob.objects.filter(pk=job.pk).update(
                progress=60,
                updated_at=timezone.now(),
            )
            with tempfile.TemporaryFile() as tmp:
                self.writer.write(job.user, sections, tmp)
                digest, size = self._checksum(tmp)
                AccountDataExportJob.objects.filter(pk=job.pk).update(
                    progress=90,
                    updated_at=timezone.now(),
                )
                return self._store(job.pk, tmp, digest, size)
        except AccountExportError as exc:
            self._fail(job.pk, exc.code, str(exc))
            raise
        except Exception as exc:
            self._fail(job.pk, "ACCOUNT_EXPORT_FAILED", "Account export failed.")
            raise AccountExportError("Account export failed.") from exc

    def _checksum(self, fileobj):
        fileobj.seek(0)
        digest = hashlib.sha256()
        size = 0
        for chunk in iter(lambda: fileobj.read(1024 * 1024), b""):
            size += len(chunk)
            digest.update(chunk)
        fileobj.seek(0)
        return digest.hexdigest(), size

    def _store(self, job_id, fileobj, digest, size):
        with transaction.atomic():
            job = AccountDataExportJob.objects.select_for_update().get(pk=job_id)
            if job.file:
                job.file.delete(save=False)
            filename = f"user-{job.user_id}/job-{job.id}/focusos-account-data.zip"
            job.file.save(filename, File(fileobj), save=False)
            job.file_size = size
            job.checksum = digest
            job.status = AccountDataExportJob.Status.COMPLETED
            job.progress = 100
            job.completed_at = timezone.now()
            job.expires_at = job.completed_at + timedelta(days=EXPORT_TTL_DAYS)
            job.error_code = ""
            job.error_message = ""
            job.save()
            return job

    def _fail(self, job_id, code, message):
        with transaction.atomic():
            job = AccountDataExportJob.objects.select_for_update().get(pk=job_id)
            if job.file:
                job.file.delete(save=False)
                job.file = ""
            job.status = AccountDataExportJob.Status.FAILED
            job.error_code = code
            job.error_message = safe_error(message)
            job.completed_at = timezone.now()
            job.save()


def create_or_reuse_account_export_job(user):
    fingerprint = account_export_fingerprint(user)
    now = timezone.now()
    with transaction.atomic():
        job = (
            AccountDataExportJob.objects.select_for_update()
            .filter(user=user, generation_fingerprint=fingerprint)
            .first()
        )
        if job and job.status in [
            AccountDataExportJob.Status.PENDING,
            AccountDataExportJob.Status.PROCESSING,
            AccountDataExportJob.Status.COMPLETED,
        ]:
            if job.status != AccountDataExportJob.Status.COMPLETED or not job.expires_at or job.expires_at > now:
                return job, False
        if job:
            if job.file:
                job.file.delete(save=False)
            job.status = AccountDataExportJob.Status.PENDING
            job.file = ""
            job.file_size = 0
            job.checksum = ""
            job.progress = 0
            job.started_at = None
            job.completed_at = None
            job.expires_at = None
            job.error_code = ""
            job.error_message = ""
            job.export_version = EXPORT_VERSION
            job.save()
            return job, True
        return (
            AccountDataExportJob.objects.create(
                user=user,
                status=AccountDataExportJob.Status.PENDING,
                export_version=EXPORT_VERSION,
                generation_fingerprint=fingerprint,
            ),
            True,
        )


def cleanup_expired_account_exports(now=None):
    now = now or timezone.now()
    count = 0
    queryset = AccountDataExportJob.objects.filter(
        status=AccountDataExportJob.Status.COMPLETED,
        expires_at__lte=now,
    )
    for job in queryset.iterator():
        if job.file:
            job.file.delete(save=False)
        job.file = ""
        job.status = AccountDataExportJob.Status.EXPIRED
        job.save(update_fields=["file", "status", "updated_at"])
        count += 1
    return count

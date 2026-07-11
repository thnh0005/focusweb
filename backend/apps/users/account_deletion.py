import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.sessions.models import Session
from django.db import transaction
from django.utils import timezone

from apps.ai.models import AIAnalysisResult
from apps.analytics.models import ReportExportJob
from apps.extension.models import ExtensionHeartbeat
from apps.sessions.models import FocusSession
from apps.tracking.models import BrowserEvent, EventBatch, WarningCycle, WarningEvent

from .models import AccountDataExportJob, AccountDeletionJob


DELETION_VERSION = "day26-v1"
DELETION_STATUS_TOKEN_BYTES = 32
DELETION_STATUS_TOKEN_HEADER = "HTTP_X_DELETION_STATUS_TOKEN"


class AccountDeletionError(Exception):
    code = "ACCOUNT_DELETION_FAILED"

    def __init__(self, message, code=None):
        super().__init__(message)
        if code:
            self.code = code


def user_identifier_snapshot(user):
    digest = hashlib.sha256(f"{user.id}:{user.email.lower()}".encode("utf-8")).hexdigest()
    return digest


def safe_error(message):
    return str(message or "Account deletion failed.")[:255]


def deletion_status_token_ttl():
    return timedelta(
        hours=getattr(settings, "ACCOUNT_DELETION_STATUS_TOKEN_TTL_HOURS", 24)
    )


def generate_deletion_status_token():
    return secrets.token_urlsafe(DELETION_STATUS_TOKEN_BYTES)


def hash_deletion_status_token(token):
    return hmac.new(
        str(settings.SECRET_KEY).encode("utf-8"),
        str(token).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_deletion_status_token(job, token, now=None):
    if not token or not job.status_token_hash or not job.status_token_expires_at:
        return False
    now = now or timezone.now()
    if job.status_token_expires_at <= now:
        return False
    candidate_hash = hash_deletion_status_token(token)
    return hmac.compare_digest(candidate_hash, job.status_token_hash)


def rotate_deletion_status_token(job):
    token = generate_deletion_status_token()
    job.status_token_hash = hash_deletion_status_token(token)
    job.status_token_expires_at = timezone.now() + deletion_status_token_ttl()
    job.save(
        update_fields=[
            "status_token_hash",
            "status_token_expires_at",
            "updated_at",
        ]
    )
    return token


def create_or_reuse_account_deletion_job(user, confirmed=False):
    with transaction.atomic():
        job = (
            AccountDeletionJob.objects.select_for_update()
            .filter(
                user=user,
                status__in=[
                    AccountDeletionJob.Status.PENDING,
                    AccountDeletionJob.Status.PROCESSING,
                ],
            )
            .first()
        )
        if job:
            if confirmed and not job.confirmed:
                job.confirmed = True
                job.save(update_fields=["confirmed", "updated_at"])
            return job, False
        return (
            AccountDeletionJob.objects.create(
                user=user,
                user_identifier_snapshot=user_identifier_snapshot(user),
                status=AccountDeletionJob.Status.PENDING,
                confirmed=confirmed,
                scheduled_for=timezone.now(),
                deletion_version=DELETION_VERSION,
            ),
            True,
        )


def cleanup_expired_account_deletion_receipts(now=None):
    now = now or timezone.now()
    expired = AccountDeletionJob.objects.filter(
        status_token_hash__gt="",
        status_token_expires_at__lt=now,
    )
    count = expired.count()
    expired.update(status_token_hash="", updated_at=now)
    return count


class SessionRevocationService:
    def revoke_user_sessions(self, user_id):
        deleted = 0
        for session in Session.objects.all().iterator():
            try:
                data = session.get_decoded()
            except Exception:
                continue
            if str(data.get("_auth_user_id")) == str(user_id):
                session.delete()
                deleted += 1
        return deleted


class AccountDeletionService:
    def __init__(self, session_revoker=None):
        self.session_revoker = session_revoker or SessionRevocationService()

    def run(self, job_id):
        not_confirmed = False
        with transaction.atomic():
            job = (
                AccountDeletionJob.objects.select_for_update()
                .select_related("user")
                .get(pk=job_id)
            )
            if job.status == AccountDeletionJob.Status.COMPLETED:
                return job
            if not job.confirmed:
                job.status = AccountDeletionJob.Status.FAILED
                job.error_code = "ACCOUNT_DELETION_NOT_CONFIRMED"
                job.error_message = "Account deletion job is not confirmed."
                job.completed_at = timezone.now()
                job.save()
                not_confirmed = True
            if not job.user:
                job.status = AccountDeletionJob.Status.COMPLETED
                job.completed_at = timezone.now()
                job.audit_summary = {
                    "deletion_version": job.deletion_version,
                    "user_already_deleted": True,
                    "completed_at": timezone.now().isoformat(),
                }
                job.save()
                return job
            if not_confirmed:
                user = None
                user_id = None
            else:
                user = job.user
                user_id = user.id
                job.status = AccountDeletionJob.Status.PROCESSING
                job.started_at = timezone.now()
                job.error_code = ""
                job.error_message = ""
                job.save(
                    update_fields=[
                        "status",
                        "started_at",
                        "error_code",
                        "error_message",
                        "updated_at",
                    ]
                )
                user.is_active = False
                user.save(update_fields=["is_active", "updated_at"])

        if not_confirmed:
            raise AccountDeletionError(
                "Account deletion job is not confirmed.",
                "ACCOUNT_DELETION_NOT_CONFIRMED",
            )

        try:
            session_count = self.session_revoker.revoke_user_sessions(user_id)
            self._cancel_pending_jobs(user_id)
            files_deleted = self._delete_user_files(user_id)
            deleted_counts = self._delete_database_rows(job_id, user_id)
            with transaction.atomic():
                job = AccountDeletionJob.objects.select_for_update().get(pk=job_id)
                job.status = AccountDeletionJob.Status.COMPLETED
                job.user = None
                job.completed_at = timezone.now()
                job.audit_summary = {
                    "deletion_version": job.deletion_version,
                    "completed_at": job.completed_at.isoformat(),
                    "sessions_revoked": session_count,
                    "files_deleted": files_deleted,
                    "deleted_counts": deleted_counts,
                }
                job.error_code = ""
                job.error_message = ""
                job.save()
                return job
        except AccountDeletionError as exc:
            self._fail(job_id, exc.code, str(exc))
            raise
        except Exception as exc:
            self._fail(job_id, "ACCOUNT_DELETION_FAILED", "Account deletion failed.")
            raise AccountDeletionError("Account deletion failed.") from exc

    def _cancel_pending_jobs(self, user_id):
        AccountDataExportJob.objects.filter(
            user_id=user_id,
            status__in=[
                AccountDataExportJob.Status.PENDING,
                AccountDataExportJob.Status.PROCESSING,
            ],
        ).update(
            status=AccountDataExportJob.Status.CANCELLED,
            error_code="ACCOUNT_DELETED",
            error_message="Account deletion cancelled this job.",
            updated_at=timezone.now(),
        )
        ReportExportJob.objects.filter(
            user_id=user_id,
            status__in=[
                ReportExportJob.Status.PENDING,
                ReportExportJob.Status.PROCESSING,
            ],
        ).update(
            status=ReportExportJob.Status.FAILED,
            error_code="ACCOUNT_DELETED",
            error_message="Account deletion cancelled this job.",
            updated_at=timezone.now(),
        )

    def _delete_user_files(self, user_id):
        count = 0
        for job in AccountDataExportJob.objects.filter(user_id=user_id).iterator():
            if job.file:
                job.file.delete(save=False)
                count += 1
        for job in ReportExportJob.objects.filter(user_id=user_id).iterator():
            if job.file:
                job.file.delete(save=False)
                count += 1
        return count

    def _delete_database_rows(self, job_id, user_id):
        session_ids = list(
            FocusSession.objects.filter(user_id=user_id).values_list("id", flat=True)
        )
        counts = {}
        counts["browser_events"] = BrowserEvent.objects.filter(
            session_id__in=session_ids
        ).delete()[0]
        counts["event_batches"] = EventBatch.objects.filter(
            session_id__in=session_ids
        ).delete()[0]
        counts["warning_events"] = WarningEvent.objects.filter(
            session_id__in=session_ids
        ).delete()[0]
        counts["warning_cycles"] = WarningCycle.objects.filter(
            session_id__in=session_ids
        ).delete()[0]
        counts["ai_analysis_results"] = AIAnalysisResult.objects.filter(
            session_id__in=session_ids
        ).delete()[0]
        counts["extension_heartbeats"] = ExtensionHeartbeat.objects.filter(
            user_id=user_id
        ).delete()[0]
        with transaction.atomic():
            job = AccountDeletionJob.objects.select_for_update().get(pk=job_id)
            user = job.user
            if user:
                counts["user_cascade"] = user.delete()[0]
        return counts

    def _fail(self, job_id, code, message):
        AccountDeletionJob.objects.filter(pk=job_id).update(
            status=AccountDeletionJob.Status.FAILED,
            error_code=code,
            error_message=safe_error(message),
            completed_at=timezone.now(),
            updated_at=timezone.now(),
        )

from celery import shared_task

from .account_deletion import AccountDeletionError, AccountDeletionService
from .account_deletion import cleanup_expired_account_deletion_receipts
from .account_export import (
    AccountDataExportService,
    AccountExportError,
    cleanup_expired_account_exports,
)
from .models import AccountDataExportJob, AccountDeletionJob


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def generate_account_data_export_task(self, job_id):
    try:
        return str(AccountDataExportService().run(job_id).id)
    except AccountDataExportJob.DoesNotExist:
        return {
            "status": "skipped",
            "job_id": str(job_id),
            "error_code": "ACCOUNT_EXPORT_JOB_NOT_FOUND",
            "retryable": False,
        }
    except AccountExportError:
        raise
    except Exception as exc:
        raise self.retry(exc=exc) from exc


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def delete_account_data_task(self, job_id):
    try:
        return str(AccountDeletionService().run(job_id).id)
    except AccountDeletionJob.DoesNotExist:
        return {
            "status": "skipped",
            "job_id": str(job_id),
            "error_code": "ACCOUNT_DELETION_JOB_NOT_FOUND",
            "retryable": False,
        }
    except AccountDeletionError:
        raise
    except Exception as exc:
        raise self.retry(exc=exc) from exc


@shared_task
def cleanup_expired_account_exports_task():
    return cleanup_expired_account_exports()


@shared_task
def cleanup_expired_account_deletion_receipts_task():
    return cleanup_expired_account_deletion_receipts()

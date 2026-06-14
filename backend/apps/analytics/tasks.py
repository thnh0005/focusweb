from celery import shared_task

from .report_export import (
    ReportExportError,
    StudyReportExportService,
    cleanup_expired_report_exports,
)
from .models import ReportExportJob


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def generate_study_report_export_task(self, job_id):
    try:
        return str(StudyReportExportService().run(job_id).id)
    except ReportExportJob.DoesNotExist:
        return {
            "status": "skipped",
            "job_id": str(job_id),
            "error_code": "REPORT_EXPORT_JOB_NOT_FOUND",
            "retryable": False,
        }
    except ReportExportError:
        raise
    except Exception as exc:
        raise self.retry(exc=exc) from exc


@shared_task
def cleanup_expired_report_exports_task():
    return cleanup_expired_report_exports()

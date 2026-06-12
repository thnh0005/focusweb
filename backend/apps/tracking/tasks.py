from celery import shared_task

from apps.tracking.services.warning_cycle_service import WarningCycleService


@shared_task
def advance_warning_cycle(cycle_id):
    return WarningCycleService().advance_cycle(cycle_id)

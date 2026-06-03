from celery import shared_task


@shared_task
def debug_ai_worker_task():
    return {
        "status": "ok",
        "worker": "ai",
        "provider": "mock",
    }

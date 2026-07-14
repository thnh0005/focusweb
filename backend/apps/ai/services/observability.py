import logging


logger = logging.getLogger("apps.ai")


def log_ai_event(event_name: str, **fields):
    safe_fields = {
        key: value
        for key, value in fields.items()
        if key
        in {
            "operation",
            "provider",
            "session_id",
            "event_id",
            "error_code",
            "retryable",
            "retry_count",
            "fallback_applied",
            "latency_ms",
            "circuit_state",
            "local_prompt_tokens",
            "calibrated_prompt_tokens",
            "estimated_total_tokens",
            "request_usage_id",
            "reserved_tokens",
            "remaining_tokens",
            "reset_seconds",
            "model",
            "task_id",
            "root_id",
            "parent_id",
            "worker_process",
            "action",
            "record_type",
            "record_id",
            "document_id",
            "attempt",
            "previous_status",
            "recovery_action",
            "status",
            "recovered_count",
            "failed_count",
            "skipped_count",
            "deck_id",
            "generation_fingerprint",
            "celery_task_id",
            "celery_root_id",
            "chunk_index",
            "chunk_id",
            "payload_hash",
            "checkpoint_last_completed_chunk",
            "completed_chunk_ids",
            "requested_quantity",
            "generated_quantity",
        }
    }
    logger.info(event_name, extra={"ai": safe_fields})

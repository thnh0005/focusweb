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
        }
    }
    logger.info(event_name, extra={"ai": safe_fields})

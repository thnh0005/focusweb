ALLOWED_EVENT_FIELDS = {
    "event_type",
    "client_event_id",
    "clientEventId",
    "occurred_at",
    "occurredAt",
    "url",
    "domain",
    "page_title",
    "meta_description",
    "content_snippet",
    "active_seconds",
    "idle_seconds",
    "tab_switch_count",
}

EVENT_FIELD_ALIASES = {
    "clientEventId": "client_event_id",
    "occurredAt": "occurred_at",
}

DISALLOWED_EVENT_FIELDS = {
    "password",
    "passwords",
    "form_input",
    "form_inputs",
    "input_value",
    "input_values",
    "keyboard_input",
    "keystrokes",
    "private_message",
    "private_messages",
    "message_body",
    "email_body",
    "full_page_content",
    "html",
    "raw_html",
    "cookies",
    "local_storage",
    "session_storage",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
}


def normalize_field_name(name) -> str:
    return str(name).strip().lower().replace("-", "_").replace(" ", "_")


def compact_field_name(name) -> str:
    return normalize_field_name(name).replace("_", "")


def find_disallowed_fields(payload: dict) -> list[str]:
    found = set()
    disallowed_compact = {
        compact_field_name(field) for field in DISALLOWED_EVENT_FIELDS
    }

    def inspect(value):
        if isinstance(value, dict):
            for key, nested_value in value.items():
                normalized_key = normalize_field_name(key)
                compact_key = compact_field_name(key)
                if (
                    normalized_key in DISALLOWED_EVENT_FIELDS
                    or compact_key in disallowed_compact
                ):
                    found.add(str(key))
                inspect(nested_value)
        elif isinstance(value, list):
            for item in value:
                inspect(item)

    inspect(payload)
    return sorted(found)


def has_disallowed_fields(payload: dict) -> bool:
    if not isinstance(payload, dict):
        return False
    return bool(find_disallowed_fields(payload))


def sanitize_event_payload(payload: dict) -> dict:
    if not isinstance(payload, dict):
        return {}

    sanitized = {}
    for key, value in payload.items():
        canonical_key = EVENT_FIELD_ALIASES.get(key, normalize_field_name(key))
        if canonical_key in ALLOWED_EVENT_FIELDS:
            sanitized[canonical_key] = value
    return sanitized


def validate_event_privacy(payload: dict) -> tuple[bool, dict, list[str]]:
    if not isinstance(payload, dict):
        return False, {}, ["payload must be an object"]

    disallowed_fields = find_disallowed_fields(payload)
    if disallowed_fields:
        return False, sanitize_event_payload(payload), disallowed_fields

    sanitized = sanitize_event_payload(payload)
    unknown_fields = sorted(
        key
        for key in payload
        if EVENT_FIELD_ALIASES.get(key, normalize_field_name(key)) not in sanitized
    )
    if unknown_fields:
        return False, sanitized, unknown_fields

    return True, sanitized, []

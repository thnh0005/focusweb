from rest_framework import serializers

from apps.tracking.privacy import (
    DISALLOWED_EVENT_FIELDS,
    find_disallowed_fields,
    validate_event_privacy,
)


class PrivacyValidator:
    SENSITIVE_FIELD_MARKERS = DISALLOWED_EVENT_FIELDS

    @classmethod
    def validate_browser_payload(cls, payload: dict) -> dict:
        if not isinstance(payload, dict):
            raise serializers.ValidationError("Browser event must be an object.")

        is_valid, sanitized, rejected_fields = validate_event_privacy(payload)
        if not is_valid and rejected_fields:
            raise serializers.ValidationError(
                {
                    "privacy": [
                        f"Unsupported or sensitive fields are not accepted: "
                        f"{', '.join(rejected_fields)}."
                    ]
                }
            )
        return sanitized

    @classmethod
    def find_sensitive_fields(cls, payload):
        return find_disallowed_fields(payload)

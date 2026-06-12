from rest_framework import serializers

from .privacy import ALLOWED_EVENT_FIELDS
from .services import PrivacyValidator


class BrowserEventIngestSerializer(serializers.Serializer):
    EVENT_TYPES = ["url_change", "tab_switch", "idle", "active", "warning"]

    event_type = serializers.ChoiceField(choices=EVENT_TYPES)
    url = serializers.URLField(required=False, allow_blank=True, max_length=2048)
    domain = serializers.CharField(required=False, allow_blank=True, max_length=255)
    page_title = serializers.CharField(required=False, allow_blank=True, max_length=500)
    meta_description = serializers.CharField(required=False, allow_blank=True, max_length=500)
    content_snippet = serializers.CharField(required=False, allow_blank=True, max_length=500)
    active_seconds = serializers.IntegerField(
        required=False,
        default=0,
        min_value=0,
        max_value=86400,
    )
    idle_seconds = serializers.IntegerField(
        required=False,
        default=0,
        min_value=0,
        max_value=86400,
    )
    tab_switch_count = serializers.IntegerField(
        required=False,
        default=0,
        min_value=0,
        max_value=10000,
    )

    def validate(self, attrs):
        sanitized = PrivacyValidator.validate_browser_payload(self.initial_data)
        unknown_fields = {
            field
            for field in self.initial_data
            if field not in sanitized and field not in ALLOWED_EVENT_FIELDS
        }
        if unknown_fields:
            raise serializers.ValidationError(
                {
                    "unknown_fields": [
                        f"Unsupported fields: {', '.join(sorted(unknown_fields))}."
                    ]
                }
            )
        return attrs


class EventBatchIngestSerializer(serializers.Serializer):
    events = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
        max_length=100,
    )

    def validate_events(self, events):
        accepted_events = []
        rejected_count = 0

        for event in events:
            serializer = BrowserEventIngestSerializer(data=event)
            if serializer.is_valid():
                accepted_events.append(serializer.validated_data)
            else:
                rejected_count += 1

        self.rejected_count = rejected_count
        self.received_count = len(events)
        return accepted_events


class EventBatchIngestResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    batch_id = serializers.UUIDField()
    accepted_count = serializers.IntegerField()
    rejected_count = serializers.IntegerField()
    rule_evaluations = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )
    semantic_evaluations = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )
    hybrid_decisions = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )
    warning_cycles = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )
    ai = serializers.DictField(required=False)

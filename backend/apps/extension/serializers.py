from rest_framework import serializers


class BlacklistEntrySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    domain = serializers.CharField()
    severity = serializers.ChoiceField(choices=["high", "medium"])
    isDefault = serializers.BooleanField()
    addedAt = serializers.DateTimeField()


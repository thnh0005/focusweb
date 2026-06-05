from rest_framework import serializers


class ExtensionHeartbeatRequestSerializer(serializers.Serializer):
    extension_version = serializers.CharField(max_length=64)
    browser = serializers.CharField(max_length=64)


class ExtensionHeartbeatResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    connected = serializers.BooleanField()
    last_seen = serializers.DateTimeField()


class ActiveSessionResponseSerializer(serializers.Serializer):
    has_active_session = serializers.BooleanField()
    session = serializers.DictField(allow_null=True)


class BlacklistEntrySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    domain = serializers.CharField()
    severity = serializers.ChoiceField(choices=["high", "medium"])
    isDefault = serializers.BooleanField()
    addedAt = serializers.DateTimeField()


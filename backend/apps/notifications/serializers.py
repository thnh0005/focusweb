from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    type = serializers.CharField(source="notification_type", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    scheduledFor = serializers.DateTimeField(source="scheduled_for", read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "title",
            "message",
            "status",
            "scheduledFor",
            "metadata",
            "createdAt",
        ]


class TestNotificationRequestSerializer(serializers.Serializer):
    type = serializers.ChoiceField(
        choices=[
            Notification.Type.SESSION_REMINDER,
            Notification.Type.WEEKLY_SUMMARY,
            Notification.Type.DEEP_WORK_SUGGESTION,
            "generic",
        ]
    )


class TestNotificationResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    test = serializers.BooleanField()
    notification = serializers.DictField()


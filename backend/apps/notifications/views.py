from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from .serializers import (
    NotificationSerializer,
    TestNotificationRequestSerializer,
    TestNotificationResponseSerializer,
)
from .services import NotificationService


class TestNotificationView(GenericAPIView):
    serializer_class = TestNotificationRequestSerializer

    @extend_schema(
        operation_id="notification_test_create",
        request=TestNotificationRequestSerializer,
        responses={201: TestNotificationResponseSerializer},
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notification, _ = NotificationService().create_test_notification(
            request.user,
            serializer.validated_data["type"],
        )
        return Response(
            {
                "status": "created",
                "test": True,
                "notification": {
                    **NotificationSerializer(notification).data,
                    "source_type": serializer.validated_data["type"],
                },
            },
            status=status.HTTP_201_CREATED,
        )


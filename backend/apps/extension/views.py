from drf_spectacular.utils import extend_schema
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .serializers import (
    ActiveSessionResponseSerializer,
    BlacklistEntrySerializer,
    ExtensionHeartbeatRequestSerializer,
    ExtensionHeartbeatResponseSerializer,
)
from .services import ActiveSessionService, HeartbeatService


class ExtensionHeartbeatView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ExtensionHeartbeatRequestSerializer

    @extend_schema(
        operation_id="extension_heartbeat",
        request=ExtensionHeartbeatRequestSerializer,
        responses=ExtensionHeartbeatResponseSerializer,
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        heartbeat = HeartbeatService.record(
            user=request.user,
            **serializer.validated_data,
        )
        data = {
            "status": "ok",
            "connected": heartbeat.is_active,
            "last_seen": heartbeat.last_seen,
        }
        return Response(ExtensionHeartbeatResponseSerializer(data).data)


class ExtensionActiveSessionView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ActiveSessionResponseSerializer

    @extend_schema(
        operation_id="extension_active_session",
        responses=ActiveSessionResponseSerializer,
    )
    def get(self, request):
        session = ActiveSessionService.get_active_session_for_user(request.user)
        data = {
            "has_active_session": session is not None,
            "session": session,
        }
        return Response(ActiveSessionResponseSerializer(data).data)


class BlacklistListView(GenericAPIView):
    serializer_class = BlacklistEntrySerializer

    @extend_schema(
        operation_id="blacklist_list",
        responses=BlacklistEntrySerializer(many=True),
    )
    def get(self, request):
        return Response([])


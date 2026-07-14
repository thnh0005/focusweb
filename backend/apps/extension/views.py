from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import NotAuthenticated, NotFound
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.sessions.extension_auth import ExtensionBridgeAuthentication, get_extension_session

from .models import (
    BlacklistEntry,
    BlacklistRuleDeletion,
    ensure_default_blacklist_entries,
)
from .serializers import (
    ActiveSessionResponseSerializer,
    BlacklistEntrySerializer,
    BlacklistSyncSerializer,
    ExtensionHeartbeatRequestSerializer,
    ExtensionHeartbeatResponseSerializer,
)
from .services import ActiveSessionService, HeartbeatService


class ExtensionHeartbeatView(GenericAPIView):
    authentication_classes = [ExtensionBridgeAuthentication, SessionAuthentication]
    permission_classes = [AllowAny]
    serializer_class = ExtensionHeartbeatRequestSerializer

    @extend_schema(
        operation_id="extension_heartbeat",
        request=ExtensionHeartbeatRequestSerializer,
        responses=ExtensionHeartbeatResponseSerializer,
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if request.user and request.user.is_authenticated:
            user = request.user
        else:
            session = get_extension_session(request)
            if session is None:
                raise NotAuthenticated("Authentication credentials were not provided.")
            user = session.user
        heartbeat = HeartbeatService.record(
            user=user,
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
        ensure_default_blacklist_entries(request.user)
        entries = BlacklistEntry.objects.available_to(request.user)
        return Response(BlacklistEntrySerializer(entries, many=True).data)

    @extend_schema(operation_id="blacklist_create", responses=BlacklistEntrySerializer)
    def post(self, request):
        serializer = BlacklistEntrySerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        entry = serializer.save(user=request.user, is_default=False)
        return Response(
            BlacklistEntrySerializer(entry).data,
            status=status.HTTP_201_CREATED,
        )


class BlacklistDetailView(GenericAPIView):
    serializer_class = BlacklistEntrySerializer

    def get_object(self, request, entry_id):
        try:
            entry = BlacklistEntry.objects.available_to(request.user).get(pk=entry_id)
        except (BlacklistEntry.DoesNotExist, ValueError) as exc:
            raise NotFound("Blacklist entry was not found.") from exc
        return entry

    @extend_schema(operation_id="blacklist_retrieve", responses=BlacklistEntrySerializer)
    def get(self, request, entry_id):
        return Response(BlacklistEntrySerializer(self.get_object(request, entry_id)).data)

    def patch(self, request, entry_id):
        entry = self.get_object(request, entry_id)
        serializer = BlacklistEntrySerializer(
            entry,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def put(self, request, entry_id):
        entry = self.get_object(request, entry_id)
        serializer = BlacklistEntrySerializer(
            entry,
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, entry_id):
        entry = self.get_object(request, entry_id)
        if entry.is_default:
            BlacklistRuleDeletion.objects.get_or_create(
                user=request.user,
                domain=entry.domain,
            )
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BlacklistSyncView(GenericAPIView):
    serializer_class = BlacklistSyncSerializer

    @extend_schema(operation_id="blacklist_sync", responses=BlacklistSyncSerializer)
    def get(self, request):
        ensure_default_blacklist_entries(request.user)
        entries = [
            {
                "domain": entry.domain,
                "severity": entry.severity,
                "enabled": entry.enabled,
                "source": "DEFAULT" if entry.is_default else "USER",
                "updatedAt": entry.updated_at,
            }
            for entry in BlacklistEntry.objects.available_to(request.user)
        ]
        data = {
            "version": "blacklist-v1",
            "generatedAt": timezone.now(),
            "entries": entries,
        }
        return Response(BlacklistSyncSerializer(data).data)

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from .models import BlacklistEntry, ensure_default_blacklist_entries
from .serializers import BlacklistEntrySerializer, BlacklistSyncSerializer


class BlacklistListView(GenericAPIView):
    serializer_class = BlacklistEntrySerializer

    @extend_schema(
        operation_id="blacklist_list",
        responses=BlacklistEntrySerializer(many=True),
    )
    def get(self, request):
        # Đảm bảo rule mặc định tồn tại cả khi test DB bị flush hoặc local DB rỗng;
        # rule custom của user sẽ được ghép thêm phía trên dữ liệu mặc định.
        ensure_default_blacklist_entries()
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
        if entry.is_default:
            raise PermissionDenied("Default blacklist entries cannot be changed.")
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
        if entry.is_default:
            raise PermissionDenied("Default blacklist entries cannot be changed.")
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
            raise PermissionDenied("Default blacklist entries cannot be deleted.")
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BlacklistSyncView(GenericAPIView):
    serializer_class = BlacklistSyncSerializer

    @extend_schema(operation_id="blacklist_sync", responses=BlacklistSyncSerializer)
    def get(self, request):
        # Payload sync cho extension không cần id DB. Browser chỉ cần domain,
        # severity và nguồn rule là mặc định hay custom.
        ensure_default_blacklist_entries()
        entries = [
            {
                "domain": entry.domain,
                "severity": entry.severity,
                "source": "default" if entry.is_default else "custom",
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


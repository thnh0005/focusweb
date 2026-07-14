from drf_spectacular.utils import extend_schema
from rest_framework.generics import GenericAPIView
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.sessions.extension_auth import ExtensionBridgeAuthentication, get_user_for_request

from .serializers import EventBatchIngestResponseSerializer, EventBatchIngestSerializer
from .services import EventIngestService


class EventBatchIngestView(GenericAPIView):
    authentication_classes = [ExtensionBridgeAuthentication, SessionAuthentication]
    permission_classes = [AllowAny]
    serializer_class = EventBatchIngestSerializer

    @extend_schema(
        operation_id="session_event_batch_ingest",
        request=EventBatchIngestSerializer,
        responses=EventBatchIngestResponseSerializer,
    )
    def post(self, request, session_id):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = get_user_for_request(request, session_id)
        result = EventIngestService.ingest_batch(
            user=user,
            session_id=session_id,
            events=serializer.validated_data["events"],
            rejected_count=serializer.rejected_count,
        )
        return Response(EventBatchIngestResponseSerializer(result).data)

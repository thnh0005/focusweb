from drf_spectacular.utils import extend_schema
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .serializers import EventBatchIngestResponseSerializer, EventBatchIngestSerializer
from .services import EventIngestService


class EventBatchIngestView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EventBatchIngestSerializer

    @extend_schema(
        operation_id="session_event_batch_ingest",
        request=EventBatchIngestSerializer,
        responses=EventBatchIngestResponseSerializer,
    )
    def post(self, request, session_id):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = EventIngestService.ingest_batch(
            user=request.user,
            session_id=session_id,
            events=serializer.validated_data["events"],
            rejected_count=serializer.rejected_count,
        )
        return Response(EventBatchIngestResponseSerializer(result).data)

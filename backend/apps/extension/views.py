from drf_spectacular.utils import extend_schema
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from .serializers import BlacklistEntrySerializer


class BlacklistListView(GenericAPIView):
    serializer_class = BlacklistEntrySerializer

    @extend_schema(
        operation_id="blacklist_list",
        responses=BlacklistEntrySerializer(many=True),
    )
    def get(self, request):
        return Response([])


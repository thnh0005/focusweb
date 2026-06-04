from drf_spectacular.utils import extend_schema
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from .serializers import StudyDocumentSerializer


class DocumentListView(GenericAPIView):
    serializer_class = StudyDocumentSerializer

    @extend_schema(operation_id="document_list", responses=StudyDocumentSerializer(many=True))
    def get(self, request):
        return Response([])


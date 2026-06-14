from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from .serializers import (
    PatternDetectionResponseSerializer,
    RecommendationResponseSerializer,
    SmartPresetResponseSerializer,
)
from .services import VALID_RANGES, FocusRecommendationService, PatternDetectionService
from .smart_preset_service import SmartPresetService


class PatternDetectionView(GenericAPIView):
    serializer_class = PatternDetectionResponseSerializer

    @extend_schema(
        operation_id="pattern_detection",
        parameters=[
            OpenApiParameter(
                name="range",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["30d", "90d", "all"],
                default="30d",
            )
        ],
        responses=PatternDetectionResponseSerializer,
    )
    def get(self, request):
        date_range = request.query_params.get("range", "30d")
        if date_range not in VALID_RANGES:
            raise ValidationError({"range": ["Unsupported date range."]})
        data = PatternDetectionService(request.user, date_range=date_range).build()
        return Response(PatternDetectionResponseSerializer(data).data)


class RecommendationView(GenericAPIView):
    serializer_class = RecommendationResponseSerializer

    @extend_schema(
        operation_id="focus_recommendations",
        parameters=[
            OpenApiParameter(
                name="range",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["30d", "90d", "all"],
                default="30d",
            ),
            OpenApiParameter(
                name="limit",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                default=5,
            ),
        ],
        responses=RecommendationResponseSerializer,
    )
    def get(self, request):
        date_range = request.query_params.get("range", "30d")
        if date_range not in VALID_RANGES:
            raise ValidationError({"range": ["Unsupported date range."]})
        limit = self.parse_limit(request.query_params.get("limit", "5"))
        data = FocusRecommendationService(
            request.user,
            date_range=date_range,
            limit=limit,
        ).build()
        return Response(RecommendationResponseSerializer(data).data)

    def parse_limit(self, value):
        try:
            limit = int(value)
        except (TypeError, ValueError) as exc:
            raise ValidationError({"limit": ["Limit must be an integer."]}) from exc
        if limit < 1 or limit > 10:
            raise ValidationError({"limit": ["Limit must be between 1 and 10."]})
        return limit


class SmartPresetView(GenericAPIView):
    serializer_class = SmartPresetResponseSerializer

    @extend_schema(
        operation_id="smart_preset",
        parameters=[
            OpenApiParameter(
                name="range",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                enum=["30d", "90d", "all"],
                default="30d",
            ),
        ],
        responses=SmartPresetResponseSerializer,
    )
    def get(self, request):
        date_range = request.query_params.get("range", "30d")
        if date_range not in VALID_RANGES:
            raise ValidationError({"range": ["Unsupported date range."]})
        data = SmartPresetService(request.user, date_range=date_range).build_for_user()
        return Response(SmartPresetResponseSerializer(data).data)

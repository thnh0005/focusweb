from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


class HealthCheckSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()


class HealthCheckView(GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = HealthCheckSerializer

    def get(self, request):
        return Response(
            {
                "status": "ok",
                "service": "focusos-backend",
            }
        )

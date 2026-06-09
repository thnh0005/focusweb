from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .serializers import (
    CsrfTokenSerializer,
    LoginSerializer,
    NotificationSettingsSerializer,
    OnboardingSerializer,
    ProfileSerializer,
    RegisterSerializer,
    UserPreferenceSerializer,
    UserSerializer,
)


def auth_response(request, user, message=None, response_status=status.HTTP_200_OK):
    """Trả user đã đăng nhập và buộc tạo CSRF cookie cho frontend SPA."""
    get_token(request)
    payload = {"user": UserSerializer(user).data}
    if message:
        payload["message"] = message
    return Response(payload, status=response_status)


class CsrfTokenView(GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = CsrfTokenSerializer

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def post(self, request):
        # Đăng ký xong sẽ login ngay để frontend đi tiếp onboarding
        # mà không cần gọi thêm request login.
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user)
        return auth_response(
            request,
            user,
            message="Registration successful.",
            response_status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_protect, name="dispatch")
class LoginView(GenericAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user)
        return auth_response(request, user, message="Login successful.")


class LogoutView(GenericAPIView):
    serializer_class = UserSerializer

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(GenericAPIView):
    serializer_class = UserSerializer

    def get(self, request):
        # Đọc /me đồng thời làm mới CSRF token cho các request ghi dữ liệu sau đó.
        get_token(request)
        return Response(UserSerializer(request.user).data)


class ProfileView(GenericAPIView):
    serializer_class = ProfileSerializer

    def get(self, request):
        return Response(ProfileSerializer(request.user.profile).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        serializer = ProfileSerializer(
            request.user.profile,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PreferenceView(GenericAPIView):
    serializer_class = UserPreferenceSerializer

    def get(self, request):
        return Response(UserPreferenceSerializer(request.user.preferences).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        serializer = UserPreferenceSerializer(
            request.user.preferences,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class NotificationSettingsView(GenericAPIView):
    serializer_class = NotificationSettingsSerializer

    def get(self, request):
        # Tuần 3 dùng lại UserPreference làm nguồn sự thật cho notification
        # để không tách bảng khi mới chỉ cần lưu cấu hình reminder/report.
        return Response(NotificationSettingsSerializer(request.user.preferences).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        serializer = NotificationSettingsSerializer(
            request.user.preferences,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class OnboardingCompleteView(GenericAPIView):
    serializer_class = OnboardingSerializer

    def post(self, request):
        # Serializer cập nhật survey, profile, preferences và cờ user cùng lúc
        # để onboarding không bị lưu dở một nửa.
        serializer = OnboardingSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "message": "Onboarding completed.",
                "user": UserSerializer(request.user).data,
            }
        )

from datetime import timedelta

from django.contrib.auth import login, logout, update_session_auth_hash
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .serializers import (
    AccountExportSerializer,
    AmbientPreferenceSerializer,
    ChangePasswordSerializer,
    CsrfTokenSerializer,
    DeleteAccountSerializer,
    LoginSerializer,
    MusicPreferenceSerializer,
    NotificationSettingsSerializer,
    OnboardingSerializer,
    ProfileSerializer,
    RegisterSerializer,
    StreakSerializer,
    ThemePreferenceSerializer,
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


class MusicPreferenceView(GenericAPIView):
    serializer_class = MusicPreferenceSerializer

    def get(self, request):
        return Response(MusicPreferenceSerializer(request.user.preferences).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        serializer = MusicPreferenceSerializer(
            request.user.preferences,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ThemePreferenceView(GenericAPIView):
    serializer_class = ThemePreferenceSerializer

    def get(self, request):
        return Response(ThemePreferenceSerializer(request.user.preferences).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        serializer = ThemePreferenceSerializer(
            request.user.preferences,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AmbientPreferenceView(GenericAPIView):
    serializer_class = AmbientPreferenceSerializer

    def get(self, request):
        return Response(AmbientPreferenceSerializer(request.user.preferences).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        serializer = AmbientPreferenceSerializer(
            request.user.preferences,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def streak_payload(user):
    from apps.sessions.models import FocusSession

    dates = list(
        FocusSession.objects.filter(
            user=user,
            status=FocusSession.Status.COMPLETED,
        )
        .order_by("-started_at")
        .values_list("started_at", flat=True)
    )
    completed_days = sorted(
        {timezone.localtime(item).date() for item in dates},
        reverse=True,
    )
    today = timezone.localdate()
    cursor = today
    if completed_days and completed_days[0] < today:
        cursor = today - timedelta(days=1)

    current_streak = 0
    completed_set = set(completed_days)
    while cursor in completed_set:
        current_streak += 1
        cursor -= timedelta(days=1)

    longest_streak = 0
    running = 0
    previous_day = None
    for day in sorted(completed_days):
        if previous_day and day == previous_day + timedelta(days=1):
            running += 1
        else:
            running = 1
        longest_streak = max(longest_streak, running)
        previous_day = day

    milestone = next((item for item in (30, 14, 7) if current_streak >= item), None)
    return {
        "currentStreak": current_streak,
        "longestStreak": longest_streak,
        "lastSessionDate": completed_days[0] if completed_days else None,
        "milestoneReached": milestone,
        "milestones": [
            {"days": days, "reached": current_streak >= days}
            for days in (3, 7, 14, 30)
        ],
    }


class StreakView(GenericAPIView):
    serializer_class = StreakSerializer

    def get(self, request):
        # Tuần 4 tính streak trực tiếp từ completed session để không cần cron.
        data = streak_payload(request.user)
        profile = request.user.profile
        profile.streak_count = data["currentStreak"]
        profile.streak_updated_at = timezone.now() if data["lastSessionDate"] else None
        profile.save(update_fields=["streak_count", "streak_updated_at", "updated_at"])
        return Response(StreakSerializer(data).data)


class ChangePasswordView(GenericAPIView):
    serializer_class = ChangePasswordSerializer

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["newPassword"])
        request.user.save(update_fields=["password", "updated_at"])
        update_session_auth_hash(request, request.user)
        return Response({"message": "Password changed."})


class AccountExportView(GenericAPIView):
    serializer_class = AccountExportSerializer

    def post(self, request):
        from apps.ai.models import StudyDocument
        from apps.ai.serializers import StudyDocumentSerializer
        from apps.sessions.models import FocusSession
        from apps.sessions.serializers import SessionSerializer

        sessions = FocusSession.objects.filter(user=request.user).prefetch_related("tags")
        documents = StudyDocument.objects.filter(user=request.user).prefetch_related(
            "summaries",
            "flashcard_decks__cards",
        )
        data = {
            "generatedAt": timezone.now(),
            "user": UserSerializer(request.user).data,
            "profile": ProfileSerializer(request.user.profile).data,
            "preferences": UserPreferenceSerializer(request.user.preferences).data,
            "sessions": SessionSerializer(sessions, many=True).data,
            "documents": StudyDocumentSerializer(documents, many=True).data,
        }
        return Response(AccountExportSerializer(data).data)


class AccountDeleteView(GenericAPIView):
    serializer_class = DeleteAccountSerializer

    def delete(self, request):
        serializer = DeleteAccountSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        logout(request)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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

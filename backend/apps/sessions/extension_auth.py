from django.utils.crypto import constant_time_compare
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, NotFound

from .models import FocusSession


TOKEN_HEADER = "HTTP_X_FOCUSOS_EXTENSION_TOKEN"
SESSION_HEADER = "HTTP_X_FOCUSOS_SESSION_ID"


def get_extension_session(request, session_id=None):
    token = request.META.get(TOKEN_HEADER, "")
    requested_session_id = session_id or request.META.get(SESSION_HEADER)
    if not token or not requested_session_id:
        return None

    try:
        session = FocusSession.objects.get(pk=requested_session_id)
    except (FocusSession.DoesNotExist, ValueError) as exc:
        raise AuthenticationFailed("Invalid extension session.") from exc

    if not session.extension_bridge_token or not constant_time_compare(
        token,
        session.extension_bridge_token,
    ):
        raise AuthenticationFailed("Invalid extension token.")

    return session


def get_session_for_request(request, session_id):
    if request.user and request.user.is_authenticated:
        try:
            return FocusSession.objects.prefetch_related("tags").get(
                pk=session_id,
                user=request.user,
            )
        except (FocusSession.DoesNotExist, ValueError) as exc:
            raise NotFound("Session was not found.") from exc

    session = get_extension_session(request, session_id)
    if session is None:
        raise NotAuthenticated("Authentication credentials were not provided.")
    return session


def get_user_for_request(request, session_id):
    if request.user and request.user.is_authenticated:
        return request.user

    session = get_extension_session(request, session_id)
    if session is None:
        raise NotAuthenticated("Authentication credentials were not provided.")
    return session.user


class ExtensionBridgeAuthentication(BaseAuthentication):
    def authenticate(self, request):
        if not request.META.get(TOKEN_HEADER):
            return None

        session = get_extension_session(request)
        if session is None:
            return None
        return session.user, session

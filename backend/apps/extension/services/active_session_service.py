from django.apps import apps


class ActiveSessionService:
    @staticmethod
    def get_active_session_for_user(user) -> dict | None:
        try:
            focus_session_model = apps.get_model("focus_sessions", "FocusSession")
        except LookupError:
            return None

        session = (
            focus_session_model.objects.filter(
                user_id=user.pk,
                status="active",
            )
            .prefetch_related("tags")
            .order_by("-started_at")
            .first()
        )
        if session is None:
            return None

        try:
            from apps.sessions.serializers import ActiveSessionSerializer
        except ImportError:
            return {
                "id": session.pk,
                "status": session.status,
            }

        return ActiveSessionSerializer(session).data

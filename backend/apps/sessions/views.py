from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from .models import FocusSession, GoalTemplate, SessionNote
from .serializers import (
    ActiveSessionSerializer,
    CreateSessionSerializer,
    EndSessionSerializer,
    GoalTemplateSerializer,
    SessionSerializer,
    SessionSummarySerializer,
    SmartPresetSerializer,
    UpdateSessionSerializer,
)
from .services import set_session_tags, transition_session


def get_owned_session(user, session_id):
    try:
        return FocusSession.objects.prefetch_related("tags").get(
            pk=session_id,
            user=user,
        )
    except (FocusSession.DoesNotExist, ValueError) as exc:
        raise NotFound("Session was not found.") from exc


class GoalTemplateListView(GenericAPIView):
    serializer_class = GoalTemplateSerializer

    @extend_schema(
        operation_id="goal_template_list",
        responses=GoalTemplateSerializer(many=True),
    )
    def get(self, request):
        templates = GoalTemplate.objects.available_to(request.user)
        return Response(GoalTemplateSerializer(templates, many=True).data)

    def post(self, request):
        serializer = GoalTemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template = serializer.save(user=request.user, is_built_in=False)
        return Response(
            GoalTemplateSerializer(template).data,
            status=status.HTTP_201_CREATED,
        )


class GoalTemplateDetailView(GenericAPIView):
    serializer_class = GoalTemplateSerializer

    def get_object(self, request, template_id):
        try:
            template = GoalTemplate.objects.get(pk=template_id)
        except GoalTemplate.DoesNotExist as exc:
            raise NotFound("Goal template was not found.") from exc
        if not template.is_built_in and template.user_id != request.user.id:
            raise NotFound("Goal template was not found.")
        return template

    @extend_schema(operation_id="goal_template_retrieve")
    def get(self, request, template_id):
        return Response(GoalTemplateSerializer(self.get_object(request, template_id)).data)

    def patch(self, request, template_id):
        template = self.get_object(request, template_id)
        if template.is_built_in:
            raise PermissionDenied("Built-in templates cannot be changed.")
        serializer = GoalTemplateSerializer(template, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def put(self, request, template_id):
        template = self.get_object(request, template_id)
        if template.is_built_in:
            raise PermissionDenied("Built-in templates cannot be changed.")
        serializer = GoalTemplateSerializer(template, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, template_id):
        template = self.get_object(request, template_id)
        if template.is_built_in:
            raise PermissionDenied("Built-in templates cannot be deleted.")
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GoalTemplateAliasListView(GenericAPIView):
    serializer_class = GoalTemplateSerializer

    @extend_schema(
        operation_id="session_goal_template_list",
        responses=GoalTemplateSerializer(many=True),
    )
    def get(self, request):
        templates = GoalTemplate.objects.available_to(request.user)
        return Response(GoalTemplateSerializer(templates, many=True).data)


class SmartPresetView(GenericAPIView):
    serializer_class = SmartPresetSerializer

    @extend_schema(operation_id="session_smart_preset", responses=SmartPresetSerializer)
    def get(self, request):
        preferences = request.user.preferences
        data = {
            "mode": preferences.default_mode,
            "durationMinutes": preferences.default_duration_minutes,
            "rationale": "Based on your default focus session preferences.",
            "confidence": 0.75,
        }
        return Response(SmartPresetSerializer(data).data)


class SessionListCreateView(GenericAPIView):
    serializer_class = SessionSerializer

    @extend_schema(operation_id="session_list")
    def get(self, request):
        sessions = FocusSession.objects.filter(user=request.user).prefetch_related("tags")
        mode = request.query_params.get("mode")
        tag = request.query_params.get("tag")
        if mode:
            sessions = sessions.filter(mode=mode)
        if tag:
            sessions = sessions.filter(tags__name=tag)

        try:
            page = max(1, int(request.query_params.get("page", 1)))
            limit = min(100, max(1, int(request.query_params.get("limit", 20))))
        except ValueError as exc:
            raise ValidationError("page and limit must be integers.") from exc

        count = sessions.count()
        start = (page - 1) * limit
        results = sessions[start : start + limit]
        next_page = page + 1 if start + limit < count else None
        return Response(
            {
                "results": SessionSerializer(results, many=True).data,
                "count": count,
                "nextPage": next_page,
            }
        )

    def post(self, request):
        serializer = CreateSessionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        session = serializer.save()
        return Response(
            ActiveSessionSerializer(session).data,
            status=status.HTTP_201_CREATED,
        )


class SessionDetailView(GenericAPIView):
    serializer_class = SessionSerializer

    @extend_schema(operation_id="session_retrieve")
    def get(self, request, session_id):
        return Response(SessionSerializer(get_owned_session(request.user, session_id)).data)

    def patch(self, request, session_id):
        session = get_owned_session(request.user, session_id)
        serializer = UpdateSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if "status" in data:
            session = transition_session(
                session,
                data["status"],
                note=data.get("note"),
                tags=data.get("tags"),
            )
        else:
            if "note" in data:
                SessionNote.objects.update_or_create(
                    session=session,
                    defaults={"content": data["note"]},
                )
            if "tags" in data:
                set_session_tags(session, data["tags"])
        session.refresh_from_db()
        return Response(SessionSerializer(session).data)


class SessionSummaryView(GenericAPIView):
    serializer_class = SessionSummarySerializer

    @extend_schema(operation_id="session_summary", responses=SessionSummarySerializer)
    def get(self, request, session_id):
        session = get_owned_session(request.user, session_id)
        if session.status != FocusSession.Status.COMPLETED:
            raise ValidationError("A summary is available after the session is completed.")
        target_minutes = max(1, session.target_duration_seconds // 60)
        data = {
            "session": session,
            "scoreBreakdown": None,
            "aiInsights": [],
            "distractionEvents": [],
            "recommendation": f"Try another {target_minutes}-minute session.",
            "isAiInsightReady": False,
        }
        return Response(SessionSummarySerializer(data).data)


class SessionPauseView(GenericAPIView):
    serializer_class = SessionSerializer

    def post(self, request, session_id):
        session = transition_session(
            get_owned_session(request.user, session_id),
            FocusSession.Status.PAUSED,
        )
        return Response(SessionSerializer(session).data)


class SessionResumeView(GenericAPIView):
    serializer_class = SessionSerializer

    def post(self, request, session_id):
        session = transition_session(
            get_owned_session(request.user, session_id),
            FocusSession.Status.ACTIVE,
        )
        return Response(SessionSerializer(session).data)


class SessionEndView(GenericAPIView):
    serializer_class = EndSessionSerializer

    def post(self, request, session_id):
        serializer = EndSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = transition_session(
            get_owned_session(request.user, session_id),
            FocusSession.Status.COMPLETED,
            note=serializer.validated_data.get("note"),
            tags=serializer.validated_data.get("tags"),
        )
        return Response(SessionSerializer(session).data)


class SessionCancelView(GenericAPIView):
    serializer_class = SessionSerializer

    def post(self, request, session_id):
        session = transition_session(
            get_owned_session(request.user, session_id),
            FocusSession.Status.CANCELLED,
        )
        return Response(SessionSerializer(session).data)

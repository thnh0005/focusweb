from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from .models import FocusSession, GoalTemplate, SessionNote, SessionTag
from .serializers import (
    ActiveSessionSerializer,
    CreateSessionSerializer,
    EndSessionSerializer,
    GoalTemplateSerializer,
    RecentContextSerializer,
    SessionSerializer,
    SessionNoteSerializer,
    SessionSummarySerializer,
    SessionTagSerializer,
    SmartPresetSerializer,
    UpdateSessionSerializer,
)
from .services import set_session_tags, transition_session


def get_owned_session(user, session_id):
    """Chỉ lấy session thuộc user hiện tại; id của user khác trả 404."""
    try:
        return FocusSession.objects.prefetch_related("tags").get(
            pk=session_id,
            user=user,
        )
    except (FocusSession.DoesNotExist, ValueError) as exc:
        raise NotFound("Session was not found.") from exc


def get_owned_tag(user, tag_id):
    """Ẩn tag của user khác bằng 404 giống các API ownership khác."""
    try:
        return SessionTag.objects.get(pk=tag_id, user=user)
    except (SessionTag.DoesNotExist, ValueError) as exc:
        raise NotFound("Tag was not found.") from exc


def get_score_breakdown(session):
    """Đổi các dòng ScoreComponent đã lưu sang cấu trúc summary của frontend."""
    try:
        score = session.score_result
    except FocusSession.score_result.RelatedObjectDoesNotExist:
        return None, {}

    components = {component.key: component.value for component in score.components.all()}
    breakdown = {
        "contentRelevance": components.get("content_relevance", 0),
        "focusContinuity": components.get("focus_continuity", 0),
        "tabStability": components.get("tab_stability", 0),
        "distractionPenalty": components.get("distraction_penalty", 0),
        "total": score.total_score,
    }
    return breakdown, score.metadata


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


class SessionTagListView(GenericAPIView):
    serializer_class = SessionTagSerializer

    @extend_schema(operation_id="tag_list", responses=SessionTagSerializer(many=True))
    def get(self, request):
        tags = SessionTag.objects.filter(user=request.user).prefetch_related("sessions")
        search = request.query_params.get("search")
        if search:
            tags = tags.filter(name__icontains=search)
        return Response(SessionTagSerializer(tags, many=True).data)

    @extend_schema(
        operation_id="tag_create",
        request=SessionTagSerializer,
        responses=SessionTagSerializer,
    )
    def post(self, request):
        serializer = SessionTagSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        tag = serializer.save(user=request.user)
        return Response(SessionTagSerializer(tag).data, status=status.HTTP_201_CREATED)


class SessionTagDetailView(GenericAPIView):
    serializer_class = SessionTagSerializer

    @extend_schema(operation_id="tag_retrieve", responses=SessionTagSerializer)
    def get(self, request, tag_id):
        return Response(SessionTagSerializer(get_owned_tag(request.user, tag_id)).data)

    def put(self, request, tag_id):
        return self._update(request, tag_id, partial=False)

    def patch(self, request, tag_id):
        return self._update(request, tag_id, partial=True)

    def _update(self, request, tag_id, partial):
        tag = get_owned_tag(request.user, tag_id)
        serializer = SessionTagSerializer(
            tag,
            data=request.data,
            partial=partial,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, tag_id):
        get_owned_tag(request.user, tag_id).delete()
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
        # Endpoint history tuần 2: hỗ trợ filter nhẹ cho dashboard drawer
        # và luôn giới hạn dữ liệu trong user hiện tại.
        sessions = FocusSession.objects.filter(user=request.user).prefetch_related("tags")
        mode = request.query_params.get("mode")
        tag = request.query_params.get("tag")
        status_filter = request.query_params.get("status")
        started_after = request.query_params.get("startedAfter")
        started_before = request.query_params.get("startedBefore")
        note_search = request.query_params.get("noteSearch") or request.query_params.get("q")
        if mode:
            sessions = sessions.filter(mode=mode)
        if tag:
            sessions = sessions.filter(tags__name=tag)
        if status_filter:
            sessions = sessions.filter(status=status_filter)
        if started_after:
            sessions = sessions.filter(started_at__gte=started_after)
        if started_before:
            sessions = sessions.filter(started_at__lte=started_before)
        if note_search:
            sessions = sessions.filter(note__content__icontains=note_search)
        sessions = sessions.distinct()

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
        # Summary chỉ đọc và được dựng từ session/score đã lưu.
        # Dev2 có thể thêm warning event và AI insight sau mà không làm đổi
        # các key response frontend đang dùng.
        session = get_owned_session(request.user, session_id)
        if session.status != FocusSession.Status.COMPLETED:
            raise ValidationError("A summary is available after the session is completed.")
        target_minutes = max(1, session.target_duration_seconds // 60)
        score_breakdown, score_metadata = get_score_breakdown(session)
        data = {
            "session": session,
            "scoreBreakdown": score_breakdown,
            "scoreMetadata": score_metadata,
            "aiInsights": [],
            "distractionEvents": [],
            "warningLog": [],
            "recommendation": f"Try another {target_minutes}-minute session.",
            "isAiInsightReady": False,
        }
        return Response(SessionSummarySerializer(data).data)


class SessionNoteView(GenericAPIView):
    serializer_class = SessionNoteSerializer

    @extend_schema(operation_id="session_note_retrieve", responses=SessionNoteSerializer)
    def get(self, request, session_id):
        session = get_owned_session(request.user, session_id)
        note, _ = SessionNote.objects.get_or_create(session=session, defaults={"content": ""})
        return Response(SessionNoteSerializer(note).data)

    @extend_schema(
        operation_id="session_note_update",
        request=SessionNoteSerializer,
        responses=SessionNoteSerializer,
    )
    def put(self, request, session_id):
        return self._update(request, session_id, partial=False)

    def patch(self, request, session_id):
        return self._update(request, session_id, partial=True)

    def _update(self, request, session_id, partial):
        session = get_owned_session(request.user, session_id)
        note, _ = SessionNote.objects.get_or_create(session=session)
        serializer = SessionNoteSerializer(note, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        note.content = serializer.validated_data.get("content", note.content)
        note.save(update_fields=["content", "updated_at"])
        return Response(SessionNoteSerializer(note).data)


class RecentContextView(GenericAPIView):
    serializer_class = RecentContextSerializer

    @extend_schema(operation_id="recent_context", responses=RecentContextSerializer)
    def get(self, request):
        # Recent context tuần 4 gom dữ liệu session gần nhất để FE dựng gợi ý nhanh.
        sessions = FocusSession.objects.filter(user=request.user).prefetch_related("tags")
        active_session = (
            sessions.filter(status__in=FocusSession.OPEN_STATUSES)
            .order_by("-started_at")
            .first()
        )
        last_completed = (
            sessions.filter(status=FocusSession.Status.COMPLETED)
            .order_by("-ended_at", "-started_at")
            .first()
        )
        recent_goals = list(
            sessions.exclude(goal="")
            .order_by("-started_at")
            .values_list("goal", flat=True)[:5]
        )
        recent_notes = [
            {
                "sessionId": str(note.session_id),
                "content": note.content,
                "updatedAt": note.updated_at,
            }
            for note in SessionNote.objects.filter(session__user=request.user)
            .exclude(content="")
            .order_by("-updated_at")[:5]
        ]
        suggested_tags = list(
            SessionTag.objects.filter(user=request.user).values_list("name", flat=True)[:8]
        )
        data = {
            "activeSession": active_session,
            "lastCompletedSession": last_completed,
            "recentGoals": recent_goals,
            "recentNotes": recent_notes,
            "suggestedTags": suggested_tags,
        }
        return Response(RecentContextSerializer(data).data)


class SessionPauseView(GenericAPIView):
    serializer_class = SessionSerializer

    def post(self, request, session_id):
        session = transition_session(
            get_owned_session(request.user, session_id),
            FocusSession.Status.PAUSED,
            allowed_from_statuses={FocusSession.Status.ACTIVE},
        )
        return Response(SessionSerializer(session).data)


class SessionResumeView(GenericAPIView):
    serializer_class = SessionSerializer

    def post(self, request, session_id):
        session = transition_session(
            get_owned_session(request.user, session_id),
            FocusSession.Status.ACTIVE,
            allowed_from_statuses={FocusSession.Status.PAUSED},
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
            allowed_from_statuses=set(FocusSession.OPEN_STATUSES),
        )
        return Response(SessionSerializer(session).data)


class SessionCancelView(GenericAPIView):
    serializer_class = SessionSerializer

    def post(self, request, session_id):
        session = transition_session(
            get_owned_session(request.user, session_id),
            FocusSession.Status.CANCELLED,
            allowed_from_statuses=set(FocusSession.OPEN_STATUSES),
        )
        return Response(SessionSerializer(session).data)

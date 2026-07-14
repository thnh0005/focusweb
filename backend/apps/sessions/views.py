from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.ai.models import SessionInsight
from apps.ai.services import (
    SessionInsightConflict,
    SessionInsightService,
    SessionInsightValidationError,
)
from apps.scoring.realtime_score_service import RealtimeScoreService
from apps.tracking.models import BrowserEvent, WarningCycle, WarningEvent

from .models import FocusSession, GoalTemplate, SessionNote, SessionTag
from .extension_auth import ExtensionBridgeAuthentication, get_session_for_request
from .serializers import (
    ActiveSessionSerializer,
    CreateSessionSerializer,
    EndSessionSerializer,
    GoalTemplateSerializer,
    RecentContextSerializer,
    RealtimeScoreResponseSerializer,
    SessionSerializer,
    SessionInsightResponseSerializer,
    SessionInsightRetryResponseSerializer,
    SessionNoteSerializer,
    SessionSummarySerializer,
    SessionTagSerializer,
    SessionWarningsResponseSerializer,
    SmartPresetSerializer,
    UpdateSessionSerializer,
)
from .services import RecentLearningContextService, set_session_tags, transition_session


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

    score_components = list(score.components.all())
    components = {component.key: component.value for component in score_components}
    score_metadata = dict(score.metadata or {})
    component_metadata = {
        component.key: component.metadata or {} for component in score_components
    }
    tab_metadata = component_metadata.get("tab_stability", {})
    for key in ("browserEventCount", "tabSwitchCount"):
        if key in tab_metadata and key not in score_metadata:
            score_metadata[key] = tab_metadata[key]
    breakdown = {
        "contentRelevance": components.get("content_relevance", 0),
        "focusContinuity": components.get("focus_continuity", 0),
        "tabStability": components.get("tab_stability", 0),
        "distractionPenalty": components.get("distraction_penalty", 0),
        "total": score.total_score,
    }
    return breakdown, score_metadata


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
        insight = SessionInsight.objects.filter(session=session).first()
        warnings = list(
            WarningEvent.objects.filter(session_id=session.id)
            .select_related("warning_cycle")
            .order_by("created_at")
        )
        browser_events = list(
            BrowserEvent.objects.filter(session_id=session.id).order_by("created_at")
        )
        distraction_events = [
            {
                "id": warning.id,
                "sessionId": session.id,
                "warningLevel": warning.warning_level,
                "domain": warning.domain,
                "triggeredAt": warning.created_at,
                "resolved": (
                    warning.warning_cycle is not None
                    and warning.warning_cycle.status
                    in {
                        WarningCycle.Status.RESOLVED,
                        WarningCycle.Status.COMPLETED,
                        WarningCycle.Status.CANCELLED,
                    }
                ),
                "warningType": warning.warning_type,
                "reasonCodes": warning.reason_codes,
            }
            for warning in warnings
        ]
        warning_log = [
            {
                "id": warning.id,
                "level": warning.warning_level,
                "type": warning.warning_type,
                "domain": warning.domain,
                "decisionState": warning.decision_state,
                "decisionSource": warning.decision_source,
                "decisionScore": warning.decision_score,
                "reasonCodes": warning.reason_codes,
                "autoPauseRequired": warning.auto_pause_required,
                "triggeredAt": warning.created_at,
            }
            for warning in warnings
        ]
        domain_counts = {}
        for event in browser_events:
            if event.domain:
                domain_counts[event.domain] = domain_counts.get(event.domain, 0) + 1
        top_domains = [
            {"domain": domain, "eventCount": count}
            for domain, count in sorted(
                domain_counts.items(),
                key=lambda item: (-item[1], item[0]),
            )[:5]
        ]
        recommendation = f"Try another {target_minutes}-minute session."
        if warnings:
            recommendation = "Review the top warning domains before your next session."
        elif insight and insight.observations:
            recommendation = insight.observations[0]
        data = {
            "session": session,
            "scoreBreakdown": score_breakdown,
            "scoreMetadata": score_metadata,
            "aiInsights": insight.observations if insight and insight.observations else [],
            "distractionEvents": distraction_events,
            "warningLog": warning_log,
            "topDistractionDomains": top_domains,
            "browserEventCount": len(browser_events),
            "recommendation": recommendation,
            "isAiInsightReady": bool(
                insight and insight.status == SessionInsight.Status.COMPLETED
            ),
            "aiInsightStatus": (
                insight.status if insight else SessionInsight.Status.PENDING
            ),
            "aiInsightSource": insight.source if insight and insight.source else None,
            "aiInsightErrorCode": (
                insight.error_code if insight and insight.error_code else None
            ),
            "aiInsightGeneratedAt": insight.generated_at if insight else None,
        }
        return Response(SessionSummarySerializer(data).data)


class SessionRealtimeScoreView(GenericAPIView):
    serializer_class = RealtimeScoreResponseSerializer

    @extend_schema(
        operation_id="session_realtime_score",
        responses=RealtimeScoreResponseSerializer,
    )
    def get(self, request, session_id):
        session = get_owned_session(request.user, session_id)
        if session.status not in {
            FocusSession.Status.ACTIVE,
            FocusSession.Status.PAUSED,
        }:
            raise ValidationError(
                "Realtime score is available for active or paused sessions."
            )
        data = RealtimeScoreService().calculate_for_session(session)
        return Response(RealtimeScoreResponseSerializer(data).data)


class SessionWarningsView(GenericAPIView):
    serializer_class = SessionWarningsResponseSerializer

    @extend_schema(
        operation_id="session_warnings",
        responses=SessionWarningsResponseSerializer,
    )
    def get(self, request, session_id):
        session = get_owned_session(request.user, session_id)
        active_cycle = (
            WarningCycle.objects.active()
            .filter(session_id=session.id)
            .order_by("-started_at")
            .first()
        )
        warnings = WarningEvent.objects.filter(session_id=session.id).order_by(
            "created_at",
            "warning_level",
        )
        data = {
            "session_id": session.id,
            "session_status": session.status,
            "mode": session.mode,
            "warning_count": warnings.count(),
            "active_cycle": self.serialize_cycle(active_cycle),
            "warnings": [
                {
                    "id": warning.id,
                    "cycle_id": warning.warning_cycle_id,
                    "level": warning.warning_level,
                    "decision_state": warning.decision_state,
                    "decision_source": warning.decision_source,
                    "decision_score": warning.decision_score,
                    "domain": warning.domain,
                    "reason_codes": warning.reason_codes,
                    "auto_pause_required": warning.auto_pause_required,
                    "triggered_at": warning.created_at,
                }
                for warning in warnings
            ],
        }
        return Response(SessionWarningsResponseSerializer(data).data)

    @staticmethod
    def serialize_cycle(cycle):
        if cycle is None:
            return None
        return {
            "cycle_id": cycle.id,
            "status": cycle.status,
            "current_level": cycle.current_level,
            "decision_source": cycle.decision_source,
            "next_warning_at": cycle.next_warning_at,
            "auto_pause_required": cycle.auto_pause_required,
            "started_at": cycle.started_at,
            "resolved_at": cycle.resolved_at,
        }


class SessionAIInsightView(GenericAPIView):
    serializer_class = SessionInsightResponseSerializer

    @extend_schema(
        operation_id="session_ai_insight",
        responses=SessionInsightResponseSerializer,
    )
    def get(self, request, session_id):
        session = get_owned_session(request.user, session_id)
        insight = SessionInsight.objects.filter(session=session).first()
        if insight is None:
            data = {
                "session_id": session.id,
                "status": SessionInsight.Status.PENDING,
                "observations": [],
                "source": None,
                "model": None,
                "generated_at": None,
                "retry_count": 0,
                "error_code": None,
            }
        else:
            data = SessionInsightService.serialize(insight)
        return Response(SessionInsightResponseSerializer(data).data)


class SessionAIInsightRetryView(GenericAPIView):
    serializer_class = SessionInsightRetryResponseSerializer

    @extend_schema(
        operation_id="session_ai_insight_retry",
        responses={202: SessionInsightRetryResponseSerializer},
    )
    def post(self, request, session_id):
        session = get_owned_session(request.user, session_id)
        service = SessionInsightService()
        try:
            insight = service.queue_manual_retry(session)
        except SessionInsightConflict as exc:
            return Response(
                {"error_code": exc.error_code, "detail": exc.message},
                status=status.HTTP_409_CONFLICT,
            )
        except SessionInsightValidationError as exc:
            raise ValidationError({"error_code": exc.error_code, "detail": exc.message})

        data = {
            "session_id": session.id,
            "status": insight.status,
            "message": "AI session insight regeneration has been queued.",
            "retry_count": insight.retry_count,
        }
        return Response(
            SessionInsightRetryResponseSerializer(data).data,
            status=status.HTTP_202_ACCEPTED,
        )


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
        data = RecentLearningContextService(request.user).build()
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
    authentication_classes = [ExtensionBridgeAuthentication, SessionAuthentication]
    permission_classes = [AllowAny]
    serializer_class = EndSessionSerializer

    def post(self, request, session_id):
        serializer = EndSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        owned_session = get_session_for_request(request, session_id)
        if owned_session.status == FocusSession.Status.COMPLETED:
            return Response(SessionSerializer(owned_session).data)
        session = transition_session(
            owned_session,
            FocusSession.Status.COMPLETED,
            note=serializer.validated_data.get("note"),
            tags=serializer.validated_data.get("tags"),
            reason=serializer.validated_data.get("reason", ""),
            metadata=serializer.validated_data.get("metadata"),
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

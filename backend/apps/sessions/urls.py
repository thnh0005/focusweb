from django.urls import path

from .views import (
    GoalTemplateDetailView,
    GoalTemplateAliasListView,
    GoalTemplateListView,
    RecentContextView,
    SessionAIInsightRetryView,
    SessionAIInsightView,
    SessionCancelView,
    SessionDetailView,
    SessionEndView,
    SessionListCreateView,
    SessionNoteView,
    SessionPauseView,
    SessionRealtimeScoreView,
    SessionResumeView,
    SessionSummaryView,
    SessionTagDetailView,
    SessionTagListView,
    SessionWarningsView,
    SmartPresetView,
)


urlpatterns = [
    path("goal-templates/", GoalTemplateListView.as_view(), name="goal-template-list"),
    path(
        "goal-templates/<str:template_id>/",
        GoalTemplateDetailView.as_view(),
        name="goal-template-detail",
    ),
    path("tags/", SessionTagListView.as_view(), name="tag-list"),
    path("tags/<uuid:tag_id>/", SessionTagDetailView.as_view(), name="tag-detail"),
    path("recent-context/", RecentContextView.as_view(), name="recent-context"),
    path("sessions/", SessionListCreateView.as_view(), name="session-list"),
    path("sessions/<uuid:session_id>/", SessionDetailView.as_view(), name="session-detail"),
    path(
        "sessions/<uuid:session_id>/note/",
        SessionNoteView.as_view(),
        name="session-note",
    ),
    path(
        "sessions/<uuid:session_id>/summary/",
        SessionSummaryView.as_view(),
        name="session-summary",
    ),
    path(
        "sessions/<uuid:session_id>/score/realtime/",
        SessionRealtimeScoreView.as_view(),
        name="session-realtime-score",
    ),
    path(
        "sessions/<uuid:session_id>/warnings/",
        SessionWarningsView.as_view(),
        name="session-warnings",
    ),
    path(
        "sessions/<uuid:session_id>/ai-insight/",
        SessionAIInsightView.as_view(),
        name="session-ai-insight",
    ),
    path(
        "sessions/<uuid:session_id>/ai-insight/retry/",
        SessionAIInsightRetryView.as_view(),
        name="session-ai-insight-retry",
    ),
    path(
        "sessions/<uuid:session_id>/pause/",
        SessionPauseView.as_view(),
        name="session-pause",
    ),
    path(
        "sessions/<uuid:session_id>/resume/",
        SessionResumeView.as_view(),
        name="session-resume",
    ),
    path(
        "sessions/<uuid:session_id>/end/",
        SessionEndView.as_view(),
        name="session-end",
    ),
    path(
        "sessions/<uuid:session_id>/cancel/",
        SessionCancelView.as_view(),
        name="session-cancel",
    ),
    # Compatibility alias used by the current Next.js client.
    path(
        "sessions/templates/",
        GoalTemplateAliasListView.as_view(),
        name="goal-template-list-alias",
    ),
    path("sessions/smart-preset/", SmartPresetView.as_view(), name="session-smart-preset"),
]

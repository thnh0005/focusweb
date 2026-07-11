from django.urls import path

from .views import EventBatchIngestView


urlpatterns = [
    path(
        "tracking/sessions/<uuid:session_id>/events/",
        EventBatchIngestView.as_view(),
        name="tracking-session-event-ingest",
    ),
    path(
        "sessions/<uuid:session_id>/events/batch/",
        EventBatchIngestView.as_view(),
        name="session-event-batch-ingest",
    ),
]

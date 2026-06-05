from django.urls import path

from .views import EventBatchIngestView


urlpatterns = [
    path(
        "sessions/<uuid:session_id>/events/batch/",
        EventBatchIngestView.as_view(),
        name="session-event-batch-ingest",
    ),
]

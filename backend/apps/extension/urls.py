from django.urls import path

from .views import (
    BlacklistDetailView,
    BlacklistListView,
    BlacklistSyncView,
    ExtensionActiveSessionView,
    ExtensionHeartbeatView,
)


urlpatterns = [
    path(
        "extension/heartbeat/",
        ExtensionHeartbeatView.as_view(),
        name="extension-heartbeat",
    ),
    path(
        "extension/active-session/",
        ExtensionActiveSessionView.as_view(),
        name="extension-active-session",
    ),
    path("blacklist/", BlacklistListView.as_view(), name="blacklist-list"),
    path("blacklist/sync/", BlacklistSyncView.as_view(), name="blacklist-sync"),
    path(
        "blacklist/<uuid:entry_id>/",
        BlacklistDetailView.as_view(),
        name="blacklist-detail",
    ),
]

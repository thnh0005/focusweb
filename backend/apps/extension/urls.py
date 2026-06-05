from django.urls import path

from .views import (
    BlacklistListView,
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
]


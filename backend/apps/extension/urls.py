from django.urls import path

from .views import BlacklistDetailView, BlacklistListView, BlacklistSyncView


urlpatterns = [
    path("blacklist/", BlacklistListView.as_view(), name="blacklist-list"),
    path("blacklist/sync/", BlacklistSyncView.as_view(), name="blacklist-sync"),
    path(
        "blacklist/<uuid:entry_id>/",
        BlacklistDetailView.as_view(),
        name="blacklist-detail",
    ),
]


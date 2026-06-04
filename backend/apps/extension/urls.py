from django.urls import path

from .views import BlacklistListView


urlpatterns = [
    path("blacklist/", BlacklistListView.as_view(), name="blacklist-list"),
]


from django.urls import path

from .views import DocumentListView


urlpatterns = [
    path("documents/", DocumentListView.as_view(), name="document-list"),
]


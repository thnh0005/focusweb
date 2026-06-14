from django.urls import path

from .views import TestNotificationView


urlpatterns = [
    path("notifications/test/", TestNotificationView.as_view(), name="notification-test"),
]

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from core.views import HealthCheckView


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", HealthCheckView.as_view(), name="health-check"),
    path("api/", include("apps.users.urls")),
    path("api/", include("apps.sessions.urls")),
    path("api/", include("apps.analytics.urls")),
    path("api/", include("apps.tracking.urls")),
    path("api/", include("apps.ai.urls")),
    path("api/", include("apps.extension.urls")),
    path("api/", include("apps.recommendations.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]

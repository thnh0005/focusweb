from django.urls import path

from .views import (
    DashboardOverviewView,
    DashboardStatsView,
    DistractionAnalyticsView,
    FocusTrendView,
    HeatmapView,
    PatternInsightsView,
    WeeklySnapshotView,
)


urlpatterns = [
    path("dashboard/overview/", DashboardOverviewView.as_view(), name="dashboard-overview"),
    path("analytics/dashboard/", DashboardStatsView.as_view(), name="analytics-dashboard"),
    path("analytics/trend/", FocusTrendView.as_view(), name="analytics-trend"),
    path(
        "analytics/distractions/",
        DistractionAnalyticsView.as_view(),
        name="analytics-distractions",
    ),
    path("analytics/heatmap/", HeatmapView.as_view(), name="analytics-heatmap"),
    path(
        "analytics/weekly-snapshot/",
        WeeklySnapshotView.as_view(),
        name="analytics-weekly-snapshot",
    ),
    path("analytics/patterns/", PatternInsightsView.as_view(), name="analytics-patterns"),
]

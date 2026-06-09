from django.urls import path

from .views import (
    AnalyticsOverviewView,
    DashboardOverviewView,
    DashboardStatsView,
    DistractionAnalyticsView,
    FocusTrendContractView,
    FocusTrendView,
    HeatmapView,
    PatternInsightsView,
    SessionBreakdownView,
    TimeHeatmapView,
    WeeklySnapshotView,
)


urlpatterns = [
    path("dashboard/overview/", DashboardOverviewView.as_view(), name="dashboard-overview"),
    path("analytics/overview/", AnalyticsOverviewView.as_view(), name="analytics-overview"),
    path("analytics/dashboard/", DashboardStatsView.as_view(), name="analytics-dashboard"),
    path(
        "analytics/focus-trend/",
        FocusTrendContractView.as_view(),
        name="analytics-focus-trend",
    ),
    path("analytics/trend/", FocusTrendView.as_view(), name="analytics-trend"),
    path(
        "analytics/distractions/",
        DistractionAnalyticsView.as_view(),
        name="analytics-distractions",
    ),
    path(
        "analytics/time-heatmap/",
        TimeHeatmapView.as_view(),
        name="analytics-time-heatmap",
    ),
    path("analytics/heatmap/", HeatmapView.as_view(), name="analytics-heatmap"),
    path(
        "analytics/session-breakdown/",
        SessionBreakdownView.as_view(),
        name="analytics-session-breakdown",
    ),
    path(
        "analytics/weekly-snapshot/",
        WeeklySnapshotView.as_view(),
        name="analytics-weekly-snapshot",
    ),
    path("analytics/patterns/", PatternInsightsView.as_view(), name="analytics-patterns"),
]

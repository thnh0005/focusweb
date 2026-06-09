from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.sessions.models import FocusSession


User = get_user_model()
PASSWORD = "A9!vQ2#pLm7$"


class DashboardStatsApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="analytics@example.com", password=PASSWORD)
        self.other_user = User.objects.create_user(
            email="analytics-other@example.com",
            password=PASSWORD,
        )
        self.client.force_authenticate(self.user)

    def create_session(self, user=None, **overrides):
        values = {
            "user": user or self.user,
            "mode": FocusSession.Mode.NORMAL,
            "status": FocusSession.Status.COMPLETED,
            "target_duration_seconds": 3600,
            "actual_duration_seconds": 1800,
            "focus_score": 80,
        }
        values.update(overrides)
        return FocusSession.objects.create(**values)

    def test_dashboard_stats_are_aggregated_for_authenticated_user(self):
        self.create_session()
        self.create_session(
            mode=FocusSession.Mode.DEEP_WORK,
            actual_duration_seconds=3600,
            focus_score=100,
        )
        self.create_session(
            status=FocusSession.Status.CANCELLED,
            actual_duration_seconds=7200,
            focus_score=None,
        )
        self.create_session(user=self.other_user, actual_duration_seconds=7200)

        response = self.client.get("/api/analytics/dashboard/?range=7d")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["totalFocusMinutes"], 90)
        self.assertEqual(response.data["totalSessions"], 3)
        self.assertEqual(response.data["averageFocusScore"], 90.0)
        self.assertEqual(response.data["deepWorkSessionCount"], 1)
        self.assertEqual(response.data["completionRate"], 66.67)
        self.assertEqual(response.data["dateRange"], "7d")

    def test_dashboard_overview_returns_week_2_mvp_metrics(self):
        self.create_session(actual_duration_seconds=1500, focus_score=75)
        active = self.create_session(
            status=FocusSession.Status.ACTIVE,
            actual_duration_seconds=0,
            focus_score=None,
        )

        response = self.client.get("/api/dashboard/overview/?range=7d")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["totalFocusMinutes"], 25)
        self.assertEqual(response.data["totalSessions"], 2)
        self.assertEqual(response.data["completedSessions"], 1)
        self.assertEqual(response.data["activeSessionId"], str(active.pk))
        self.assertEqual(response.data["dateRange"], "7d")

    def test_dashboard_range_and_validation(self):
        old_session = self.create_session()
        FocusSession.objects.filter(pk=old_session.pk).update(
            started_at=timezone.now() - timedelta(days=10)
        )

        recent = self.client.get("/api/analytics/dashboard/?range=7d")
        all_time = self.client.get("/api/analytics/dashboard/?range=all")
        invalid = self.client.get("/api/analytics/dashboard/?range=year")

        self.assertEqual(recent.data["totalSessions"], 0)
        self.assertEqual(recent.data["averageFocusScore"], None)
        self.assertEqual(all_time.data["totalSessions"], 1)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_analytics_page_endpoints_return_frontend_contracts(self):
        self.create_session(
            mode=FocusSession.Mode.DEEP_WORK,
            actual_duration_seconds=2700,
            focus_score=95,
            focus_state="deep-focus",
        )
        self.create_session(actual_duration_seconds=1800, focus_score=75, focus_state="focused")

        overview = self.client.get("/api/analytics/overview/?range=7d")
        trend = self.client.get("/api/analytics/trend/?range=7d")
        focus_trend = self.client.get("/api/analytics/focus-trend/?range=7d")
        distractions = self.client.get("/api/analytics/distractions/?range=7d")
        heatmap = self.client.get("/api/analytics/heatmap/")
        time_heatmap = self.client.get("/api/analytics/time-heatmap/")
        breakdown = self.client.get("/api/analytics/session-breakdown/?range=7d")
        weekly = self.client.get("/api/analytics/weekly-snapshot/")
        patterns = self.client.get("/api/analytics/patterns/")

        self.assertEqual(overview.status_code, status.HTTP_200_OK)
        self.assertEqual(overview.data["totalSessions"], 2)
        self.assertEqual(overview.data["completedSessions"], 2)
        self.assertEqual(overview.data["averageSessionMinutes"], 37.5)
        self.assertEqual(trend.status_code, status.HTTP_200_OK)
        self.assertEqual(trend.data["dataPoints"][0]["sessionCount"], 2)
        self.assertEqual(trend.data["dataPoints"][0]["totalMinutes"], 75)
        self.assertEqual(focus_trend.status_code, status.HTTP_200_OK)
        self.assertEqual(distractions.data["topSources"], [])
        self.assertEqual(heatmap.status_code, status.HTTP_200_OK)
        self.assertEqual(heatmap.data[0]["sessionCount"], 2)
        self.assertEqual(time_heatmap.status_code, status.HTTP_200_OK)
        self.assertEqual(breakdown.status_code, status.HTTP_200_OK)
        self.assertEqual(breakdown.data["normalSessionCount"], 1)
        self.assertEqual(breakdown.data["deepWorkSessionCount"], 1)
        self.assertEqual(weekly.data["thisWeek"]["totalFocusMinutes"], 75)
        self.assertEqual(patterns.data["sessionsAnalyzed"], 2)

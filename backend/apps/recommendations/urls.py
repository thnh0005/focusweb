from django.urls import path

from .views import PatternDetectionView, RecommendationView, SmartPresetView


urlpatterns = [
    path("patterns/", PatternDetectionView.as_view(), name="pattern-detection"),
    path("recommendations/", RecommendationView.as_view(), name="focus-recommendations"),
    path("smart-preset/", SmartPresetView.as_view(), name="smart-preset"),
]

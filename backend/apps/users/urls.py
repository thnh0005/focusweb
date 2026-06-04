from django.urls import path

from .views import (
    LoginView,
    LogoutView,
    MeView,
    OnboardingCompleteView,
    PreferenceView,
    ProfileView,
    RegisterView,
)


urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("users/profile/", ProfileView.as_view(), name="user-profile"),
    path("users/preferences/", PreferenceView.as_view(), name="user-preferences"),
    path(
        "onboarding/complete/",
        OnboardingCompleteView.as_view(),
        name="onboarding-complete",
    ),
    # Compatibility aliases used by the current Next.js client.
    path("user/profile/", ProfileView.as_view(), name="user-profile-alias"),
    path("user/preferences/", PreferenceView.as_view(), name="user-preferences-alias"),
    path(
        "auth/onboarding/",
        OnboardingCompleteView.as_view(),
        name="onboarding-complete-alias",
    ),
]


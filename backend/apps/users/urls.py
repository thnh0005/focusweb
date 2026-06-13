from django.urls import path

from .views import (
    AccountDeleteView,
    AccountExportView,
    AmbientPreferenceView,
    ChangePasswordView,
    CsrfTokenView,
    LoginView,
    LogoutView,
    MeView,
    MusicPreferenceView,
    NotificationSettingsView,
    OnboardingCompleteView,
    PreferenceView,
    ProfileView,
    RegisterView,
    StreakView,
    ThemePreferenceView,
)


urlpatterns = [
    path("auth/csrf/", CsrfTokenView.as_view(), name="auth-csrf"),
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("users/profile/", ProfileView.as_view(), name="user-profile"),
    path("users/preferences/", PreferenceView.as_view(), name="user-preferences"),
    path(
        "notifications/settings/",
        NotificationSettingsView.as_view(),
        name="notification-settings",
    ),
    path("streak/", StreakView.as_view(), name="streak"),
    path("user/streak/", StreakView.as_view(), name="user-streak-alias"),
    path("music/preferences/", MusicPreferenceView.as_view(), name="music-preferences"),
    path("theme/preferences/", ThemePreferenceView.as_view(), name="theme-preferences"),
    path(
        "ambient/preferences/",
        AmbientPreferenceView.as_view(),
        name="ambient-preferences",
    ),
    path(
        "account/change-password/",
        ChangePasswordView.as_view(),
        name="account-change-password",
    ),
    path(
        "account/export-data/",
        AccountExportView.as_view(),
        name="account-export-data",
    ),
    path("account/delete/", AccountDeleteView.as_view(), name="account-delete"),
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


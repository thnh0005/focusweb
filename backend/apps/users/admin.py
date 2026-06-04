from django.contrib import admin

from .models import OnboardingSurvey, Profile, User, UserPreference


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "display_name", "is_active", "is_staff", "created_at")
    search_fields = ("email", "display_name")
    readonly_fields = ("password", "last_login", "created_at", "updated_at")


admin.site.register(Profile)
admin.site.register(UserPreference)
admin.site.register(OnboardingSurvey)


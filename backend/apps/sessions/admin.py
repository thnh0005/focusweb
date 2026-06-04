from django.contrib import admin

from .models import (
    FocusSession,
    GoalTemplate,
    SessionNote,
    SessionStateTransition,
    SessionTag,
)


admin.site.register(GoalTemplate)
admin.site.register(SessionTag)
admin.site.register(FocusSession)
admin.site.register(SessionNote)
admin.site.register(SessionStateTransition)


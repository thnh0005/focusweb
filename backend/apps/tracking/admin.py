from django.contrib import admin

from .models import BrowserEvent, EventBatch, WarningCycle, WarningEvent


admin.site.register(BrowserEvent)
admin.site.register(EventBatch)
admin.site.register(WarningCycle)
admin.site.register(WarningEvent)

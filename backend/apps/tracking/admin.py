from django.contrib import admin

from .models import BrowserEvent, EventBatch, WarningEvent


admin.site.register(BrowserEvent)
admin.site.register(EventBatch)
admin.site.register(WarningEvent)

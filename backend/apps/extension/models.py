import uuid

from django.db import models
from django.utils import timezone


class ExtensionHeartbeat(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField()
    extension_version = models.CharField(max_length=64)
    browser = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True)
    last_seen = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-last_seen"]
        indexes = [
            models.Index(fields=["user_id", "last_seen"]),
            models.Index(fields=["is_active", "last_seen"]),
        ]

    def __str__(self):
        return f"{self.browser} {self.extension_version}: {self.user_id}"

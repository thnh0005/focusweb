from django.db import transaction
from django.utils import timezone

from apps.extension.models import ExtensionHeartbeat


class HeartbeatService:
    @staticmethod
    @transaction.atomic
    def record(user, extension_version, browser):
        heartbeat = (
            ExtensionHeartbeat.objects.select_for_update()
            .filter(user_id=user.pk)
            .order_by("-last_seen")
            .first()
        )
        now = timezone.now()

        if heartbeat is None:
            return ExtensionHeartbeat.objects.create(
                user_id=user.pk,
                extension_version=extension_version,
                browser=browser,
                is_active=True,
                last_seen=now,
            )

        heartbeat.extension_version = extension_version
        heartbeat.browser = browser
        heartbeat.is_active = True
        heartbeat.last_seen = now
        heartbeat.save(
            update_fields=[
                "extension_version",
                "browser",
                "is_active",
                "last_seen",
            ]
        )
        return heartbeat

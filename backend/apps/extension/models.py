import uuid
from urllib.parse import urlparse

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


DEFAULT_BLACKLIST_DOMAINS = [
    ("youtube.com", "high"),
    ("facebook.com", "high"),
    ("instagram.com", "high"),
    ("tiktok.com", "high"),
    ("reddit.com", "medium"),
    ("twitter.com", "medium"),
    ("x.com", "medium"),
    ("netflix.com", "medium"),
]


def ensure_default_blacklist_entries():
    for domain, severity in DEFAULT_BLACKLIST_DOMAINS:
        BlacklistEntry.objects.update_or_create(
            domain=domain,
            is_default=True,
            defaults={
                "user": None,
                "severity": severity,
            },
        )


def normalize_domain(value):
    raw_value = (value or "").strip().lower()
    parsed = urlparse(raw_value if "://" in raw_value else f"https://{raw_value}")
    domain = parsed.netloc or parsed.path
    return domain.split("/", maxsplit=1)[0].removeprefix("www.")


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


class BlacklistEntryQuerySet(models.QuerySet):
    def available_to(self, user):
        return self.filter(Q(is_default=True) | Q(user=user)).order_by(
            "-is_default",
            "domain",
        )


class BlacklistEntry(models.Model):
    class Severity(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blacklist_entries",
        null=True,
        blank=True,
    )
    domain = models.CharField(max_length=253)
    severity = models.CharField(
        max_length=12,
        choices=Severity.choices,
        default=Severity.MEDIUM,
    )
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = BlacklistEntryQuerySet.as_manager()

    class Meta:
        ordering = ["-is_default", "domain"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(is_default=True, user__isnull=True)
                    | Q(is_default=False, user__isnull=False)
                ),
                name="blacklist_owner_matches_type",
            ),
            models.UniqueConstraint(
                fields=["domain"],
                condition=Q(is_default=True),
                name="unique_default_blacklist_domain",
            ),
            models.UniqueConstraint(
                fields=["user", "domain"],
                condition=Q(is_default=False),
                name="unique_custom_blacklist_domain_per_user",
            ),
        ]

    def save(self, *args, **kwargs):
        self.domain = normalize_domain(self.domain)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.domain

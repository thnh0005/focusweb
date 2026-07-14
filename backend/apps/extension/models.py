import uuid
from urllib.parse import urlparse

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


DEFAULT_BLACKLIST_DOMAINS = [
    ("facebook.com", "high"),
    ("instagram.com", "high"),
    ("tiktok.com", "high"),
    ("twitter.com", "high"),
    ("x.com", "high"),
    ("reddit.com", "high"),
    ("threads.net", "high"),
    ("snapchat.com", "high"),
    ("pinterest.com", "high"),
    ("tumblr.com", "high"),
    ("linkedin.com", "high"),
    ("youtube.com", "high"),
    ("twitch.tv", "high"),
    ("discord.com", "high"),
    ("messenger.com", "high"),
    ("telegram.org", "high"),
    ("web.telegram.org", "high"),
    ("zalo.me", "high"),
    ("chat.zalo.me", "high"),
]


def ensure_default_blacklist_entries(user=None):
    if user is None:
        return
    for domain, severity in DEFAULT_BLACKLIST_DOMAINS:
        normalized_domain = normalize_domain(domain)
        if BlacklistRuleDeletion.objects.filter(user=user, domain=normalized_domain).exists():
            continue
        BlacklistEntry.objects.get_or_create(
            user=user,
            domain=domain,
            is_default=True,
            defaults={
                "severity": severity,
                "enabled": True,
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
        return self.filter(user=user).order_by(
            "-is_default",
            "domain",
        )


class BlacklistEntry(models.Model):
    class Severity(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

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
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = BlacklistEntryQuerySet.as_manager()

    class Meta:
        ordering = ["-is_default", "domain"]
        constraints = [
            models.CheckConstraint(
                condition=Q(user__isnull=False),
                name="blacklist_owner_matches_type",
            ),
            models.UniqueConstraint(
                fields=["user", "domain"],
                name="unique_custom_blacklist_domain_per_user",
            ),
        ]

    def save(self, *args, **kwargs):
        self.domain = normalize_domain(self.domain)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.domain


class BlacklistRuleDeletion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="deleted_default_blacklist_rules",
    )
    domain = models.CharField(max_length=253)
    deleted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "domain"],
                name="unique_deleted_default_blacklist_rule",
            ),
        ]

    def save(self, *args, **kwargs):
        self.domain = normalize_domain(self.domain)
        super().save(*args, **kwargs)

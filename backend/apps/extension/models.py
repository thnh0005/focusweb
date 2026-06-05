import uuid
from urllib.parse import urlparse

from django.conf import settings
from django.db import models
from django.db.models import Q


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
    """Đảm bảo domain mặc định vẫn có sau khi test DB bị flush hoặc DB mới rỗng."""
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
    """Chuẩn hóa URL/domain người dùng nhập trước khi lưu hoặc sync."""
    raw_value = (value or "").strip().lower()
    parsed = urlparse(raw_value if "://" in raw_value else f"https://{raw_value}")
    domain = parsed.netloc or parsed.path
    return domain.split("/", maxsplit=1)[0].removeprefix("www.")


class BlacklistEntryQuerySet(models.QuerySet):
    def available_to(self, user):
        """Trả rule mặc định kèm boundary riêng của người dùng."""
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

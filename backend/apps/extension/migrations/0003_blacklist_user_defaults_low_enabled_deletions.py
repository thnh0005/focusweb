import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


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


def seed_user_defaults(apps, schema_editor):
    User = apps.get_model("users", "User")
    BlacklistEntry = apps.get_model("extension", "BlacklistEntry")
    BlacklistEntry.objects.filter(is_default=True, user__isnull=True).delete()
    for user in User.objects.all().iterator():
        for domain, severity in DEFAULT_BLACKLIST_DOMAINS:
            BlacklistEntry.objects.get_or_create(
                user=user,
                domain=domain,
                defaults={
                    "severity": severity,
                    "is_default": True,
                    "enabled": True,
                },
            )


class Migration(migrations.Migration):
    dependencies = [
        ("extension", "0002_blacklistentry"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="blacklistentry",
            name="blacklist_owner_matches_type",
        ),
        migrations.RemoveConstraint(
            model_name="blacklistentry",
            name="unique_default_blacklist_domain",
        ),
        migrations.RemoveConstraint(
            model_name="blacklistentry",
            name="unique_custom_blacklist_domain_per_user",
        ),
        migrations.AddField(
            model_name="blacklistentry",
            name="enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="blacklistentry",
            name="severity",
            field=models.CharField(
                choices=[("high", "High"), ("medium", "Medium"), ("low", "Low")],
                default="medium",
                max_length=12,
            ),
        ),
        migrations.CreateModel(
            name="BlacklistRuleDeletion",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("domain", models.CharField(max_length=253)),
                ("deleted_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="deleted_default_blacklist_rules",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="blacklistentry",
            constraint=models.CheckConstraint(
                condition=models.Q(("user__isnull", False)),
                name="blacklist_owner_matches_type",
            ),
        ),
        migrations.AddConstraint(
            model_name="blacklistentry",
            constraint=models.UniqueConstraint(
                fields=("user", "domain"),
                name="unique_custom_blacklist_domain_per_user",
            ),
        ),
        migrations.AddConstraint(
            model_name="blacklistruledeletion",
            constraint=models.UniqueConstraint(
                fields=("user", "domain"),
                name="unique_deleted_default_blacklist_rule",
            ),
        ),
        migrations.RunPython(seed_user_defaults, migrations.RunPython.noop),
    ]

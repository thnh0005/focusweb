# Generated for Dev 1 week 4 settings APIs.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="userpreference",
            name="theme",
            field=models.CharField(
                choices=[
                    ("cyber", "Cyber"),
                    ("minimal", "Minimal"),
                    ("forest", "Forest"),
                    ("minimal-dark", "Minimal Dark"),
                    ("aurora-night", "Aurora Night"),
                    ("forest-calm", "Forest Calm"),
                    ("rain-room", "Rain Room"),
                ],
                default="forest",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="userpreference",
            name="music_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="userpreference",
            name="music_track",
            field=models.CharField(
                choices=[
                    ("rain", "Rain"),
                    ("forest", "Forest"),
                    ("lofi", "Lo-fi"),
                    ("white-noise", "White Noise"),
                ],
                default="rain",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="userpreference",
            name="custom_playlist_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="userpreference",
            name="ambient_effect_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="userpreference",
            name="ambient_effect_intensity",
            field=models.PositiveSmallIntegerField(default=50),
        ),
        migrations.AddField(
            model_name="userpreference",
            name="theme_accent",
            field=models.CharField(blank=True, default="moss", max_length=24),
        ),
        migrations.AddField(
            model_name="userpreference",
            name="workspace_background_url",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="userpreference",
            name="auto_resume_session",
            field=models.BooleanField(default=False),
        ),
    ]

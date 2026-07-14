from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("focus_sessions", "0002_seed_goal_templates"),
    ]

    operations = [
        migrations.AddField(
            model_name="focussession",
            name="end_reason",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="focussession",
            name="end_metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("focus_sessions", "0003_focus_session_end_reason_metadata"),
    ]

    operations = [
        migrations.AddField(
            model_name="focussession",
            name="extension_bridge_token",
            field=models.CharField(blank=True, max_length=128),
        ),
    ]

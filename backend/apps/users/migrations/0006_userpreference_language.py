from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0005_accountdeletionjob_status_token_expires_at_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="userpreference",
            name="language",
            field=models.CharField(
                choices=[("vi", "Vietnamese"), ("en", "English")],
                default="vi",
                max_length=2,
            ),
        ),
    ]

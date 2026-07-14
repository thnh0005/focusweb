from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ai", "0006_documentaijob_documentaichunk_and_more"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="flashcarddeck",
            constraint=models.UniqueConstraint(
                fields=("generation_fingerprint",),
                condition=~models.Q(("generation_fingerprint", "")),
                name="unique_flashcard_generation_fingerprint",
            ),
        ),
    ]

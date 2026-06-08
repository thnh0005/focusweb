# Generated during Dev 1 Week 2 audit.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scoring", "0001_initial"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="focusscore",
            constraint=models.CheckConstraint(
                condition=models.Q(("total_score__gte", 0), ("total_score__lte", 100)),
                name="focus_score_total_between_0_100",
            ),
        ),
        migrations.AddConstraint(
            model_name="scorecomponent",
            constraint=models.CheckConstraint(
                condition=models.Q(("value__gte", 0), ("value__lte", 100)),
                name="score_component_value_between_0_100",
            ),
        ),
        migrations.AddConstraint(
            model_name="scorecomponent",
            constraint=models.CheckConstraint(
                condition=models.Q(("weight__gte", 0), ("weight__lte", 1)),
                name="score_component_weight_between_0_1",
            ),
        ),
    ]

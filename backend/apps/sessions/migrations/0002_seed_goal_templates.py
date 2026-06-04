from django.db import migrations


BUILT_IN_TEMPLATES = [
    ("tpl-code-project", "Code Project", "Work on my coding project"),
    (
        "tpl-read-docs",
        "Read Documentation",
        "Read and understand technical documentation",
    ),
    ("tpl-assignment", "Complete Assignment", "Complete my current assignment"),
    ("tpl-revision", "Revision / Review", "Review and revise study materials"),
    ("tpl-write-report", "Write Report", "Write and edit my report"),
    ("tpl-research", "Research", "Research a specific topic in depth"),
    ("tpl-leetcode", "Problem Solving", "Solve algorithmic problems and exercises"),
    ("tpl-design", "Design Work", "Work on UI/UX design tasks"),
    (
        "tpl-learn-concept",
        "Learn Concept",
        "Deep dive into a new concept or technology",
    ),
    ("tpl-debug", "Debug / Fix Issues", "Debug and resolve technical issues"),
    ("tpl-review-code", "Code Review", "Review and provide feedback on code"),
    (
        "tpl-plan",
        "Plan & Architecture",
        "Plan project architecture and technical decisions",
    ),
    ("tpl-study-exam", "Exam Preparation", "Study and prepare for upcoming exam"),
    ("tpl-language", "Language Learning", "Practice and improve language skills"),
    (
        "tpl-creative",
        "Creative Work",
        "Focus on creative writing or content creation",
    ),
]


def seed_goal_templates(apps, schema_editor):
    GoalTemplate = apps.get_model("focus_sessions", "GoalTemplate")
    for template_id, label, text in BUILT_IN_TEMPLATES:
        GoalTemplate.objects.update_or_create(
            id=template_id,
            defaults={
                "label": label,
                "text": text,
                "is_built_in": True,
                "user": None,
            },
        )


def remove_goal_templates(apps, schema_editor):
    GoalTemplate = apps.get_model("focus_sessions", "GoalTemplate")
    GoalTemplate.objects.filter(
        id__in=[template[0] for template in BUILT_IN_TEMPLATES],
        is_built_in=True,
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("focus_sessions", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_goal_templates, remove_goal_templates),
    ]


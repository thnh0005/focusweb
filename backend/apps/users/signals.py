from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import OnboardingSurvey, Profile, User, UserPreference


@receiver(post_save, sender=User)
def create_user_related_records(sender, instance, created, **kwargs):
    if not created:
        return

    Profile.objects.create(user=instance)
    UserPreference.objects.create(user=instance)
    OnboardingSurvey.objects.create(user=instance)


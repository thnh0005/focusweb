from rest_framework import serializers

from .models import BlacklistEntry, normalize_domain


class BlacklistEntrySerializer(serializers.ModelSerializer):
    isDefault = serializers.BooleanField(source="is_default", read_only=True)
    addedAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = BlacklistEntry
        fields = ["id", "domain", "severity", "isDefault", "addedAt", "updatedAt"]
        read_only_fields = ["id", "isDefault", "addedAt", "updatedAt"]

    def validate_domain(self, value):
        domain = normalize_domain(value)
        if "." not in domain:
            raise serializers.ValidationError("Enter a valid domain.")
        return domain

    def validate(self, attrs):
        request = self.context["request"]
        domain = attrs.get("domain", getattr(self.instance, "domain", ""))
        queryset = BlacklistEntry.objects.available_to(request.user).filter(domain=domain)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                {"domain": ["This domain is already protected."]}
            )
        return attrs


class BlacklistSyncEntrySerializer(serializers.Serializer):
    domain = serializers.CharField()
    severity = serializers.ChoiceField(choices=BlacklistEntry.Severity.choices)
    source = serializers.ChoiceField(choices=["default", "custom"])
    updatedAt = serializers.DateTimeField()


class BlacklistSyncSerializer(serializers.Serializer):
    version = serializers.CharField()
    generatedAt = serializers.DateTimeField()
    entries = BlacklistSyncEntrySerializer(many=True)


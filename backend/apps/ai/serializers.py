from rest_framework import serializers


class StudyDocumentSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    userId = serializers.UUIDField()
    filename = serializers.CharField()
    originalName = serializers.CharField()
    fileType = serializers.ChoiceField(choices=["pdf", "docx", "txt"])
    fileSizeBytes = serializers.IntegerField(min_value=0)
    pageCount = serializers.IntegerField(min_value=0, required=False)
    status = serializers.ChoiceField(choices=["uploaded", "processing", "ready", "error"])
    hasSummary = serializers.BooleanField()
    hasFlashcards = serializers.BooleanField()
    uploadedAt = serializers.DateTimeField()
    processedAt = serializers.DateTimeField(required=False)


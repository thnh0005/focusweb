from rest_framework import serializers

from .models import DocumentSummary, Flashcard, FlashcardDeck, FlashcardReviewSession
from .models import StudyDocument
from .services.document_parser import ALLOWED_DOCUMENT_TYPES, infer_file_type


class StudyDocumentSerializer(serializers.ModelSerializer):
    userId = serializers.UUIDField(source="user_id", read_only=True)
    originalName = serializers.CharField(source="original_name")
    fileType = serializers.ChoiceField(source="file_type", choices=StudyDocument.FileType.choices)
    fileSizeBytes = serializers.IntegerField(source="file_size_bytes", read_only=True)
    pageCount = serializers.IntegerField(source="page_count", read_only=True)
    hasSummary = serializers.SerializerMethodField()
    hasFlashcards = serializers.SerializerMethodField()
    uploadedAt = serializers.DateTimeField(source="uploaded_at", read_only=True)
    processedAt = serializers.DateTimeField(source="processed_at", read_only=True)

    class Meta:
        model = StudyDocument
        fields = [
            "id",
            "userId",
            "filename",
            "originalName",
            "fileType",
            "fileSizeBytes",
            "pageCount",
            "status",
            "hasSummary",
            "hasFlashcards",
            "uploadedAt",
            "processedAt",
        ]
        read_only_fields = [
            "id",
            "userId",
            "filename",
            "fileType",
            "fileSizeBytes",
            "pageCount",
            "status",
            "uploadedAt",
            "processedAt",
        ]

    def get_hasSummary(self, instance) -> bool:
        return instance.summaries.exists()

    def get_hasFlashcards(self, instance) -> bool:
        return instance.flashcard_decks.filter(cards__isnull=False).distinct().exists()


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        file_type = infer_file_type(value.name)
        if file_type not in ALLOWED_DOCUMENT_TYPES:
            raise serializers.ValidationError("Only PDF, DOCX, and TXT files are supported.")
        if value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("File must be 10 MB or smaller.")
        return value


class StudyDocumentUpdateSerializer(serializers.ModelSerializer):
    originalName = serializers.CharField(
        source="original_name",
        required=False,
        allow_blank=False,
        max_length=255,
    )

    class Meta:
        model = StudyDocument
        fields = ["originalName"]


class GenerateSummarySerializer(serializers.Serializer):
    mode = serializers.ChoiceField(
        choices=DocumentSummary.Mode.choices,
        default=DocumentSummary.Mode.DETAILED,
        required=False,
    )


class DocumentSummarySerializer(serializers.ModelSerializer):
    documentId = serializers.UUIDField(source="document_id", read_only=True)
    generatedAt = serializers.DateTimeField(source="generated_at", read_only=True)

    class Meta:
        model = DocumentSummary
        fields = ["id", "documentId", "mode", "content", "generatedAt"]


class FlashcardSerializer(serializers.ModelSerializer):
    documentId = serializers.UUIDField(source="document_id", read_only=True)
    deckId = serializers.UUIDField(source="deck_id", read_only=True)
    pageReference = serializers.CharField(source="page_reference", read_only=True)

    class Meta:
        model = Flashcard
        fields = [
            "id",
            "documentId",
            "deckId",
            "question",
            "answer",
            "difficulty",
            "pageReference",
            "order",
        ]


class GenerateFlashcardsSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=50, default=5)
    difficulty = serializers.ChoiceField(
        choices=FlashcardDeck.Difficulty.choices,
        default=FlashcardDeck.Difficulty.MEDIUM,
    )
    page_range = serializers.DictField(required=False)
    pageRange = serializers.DictField(required=False)

    def validate(self, attrs):
        attrs["page_range"] = attrs.get("page_range") or attrs.get("pageRange") or {}
        attrs.pop("pageRange", None)
        return attrs


class FlashcardDeckSerializer(serializers.ModelSerializer):
    documentId = serializers.UUIDField(source="document_id", read_only=True)
    pageRange = serializers.JSONField(source="page_range", read_only=True)
    cards = FlashcardSerializer(many=True, read_only=True)
    generatedAt = serializers.DateTimeField(source="generated_at", read_only=True)

    class Meta:
        model = FlashcardDeck
        fields = [
            "id",
            "documentId",
            "title",
            "quantity",
            "difficulty",
            "pageRange",
            "cards",
            "generatedAt",
        ]


class FlashcardDeckUpdateSerializer(serializers.ModelSerializer):
    pageRange = serializers.JSONField(source="page_range", required=False)

    class Meta:
        model = FlashcardDeck
        fields = ["title", "difficulty", "pageRange"]
        extra_kwargs = {
            "title": {"required": False, "allow_blank": True},
            "difficulty": {"required": False},
        }


class CreateReviewSessionSerializer(serializers.Serializer):
    reviewedCardIds = serializers.ListField(
        source="reviewed_card_ids",
        child=serializers.UUIDField(),
        required=False,
    )
    correctCardIds = serializers.ListField(
        source="correct_card_ids",
        child=serializers.UUIDField(),
        required=False,
    )
    metadata = serializers.DictField(required=False)


class FlashcardReviewSessionSerializer(serializers.ModelSerializer):
    deckId = serializers.UUIDField(source="deck_id", read_only=True)
    totalCards = serializers.IntegerField(source="total_cards", read_only=True)
    reviewedCount = serializers.IntegerField(source="reviewed_count", read_only=True)
    correctCount = serializers.IntegerField(source="correct_count", read_only=True)
    startedAt = serializers.DateTimeField(source="started_at", read_only=True)
    completedAt = serializers.DateTimeField(source="completed_at", read_only=True)

    class Meta:
        model = FlashcardReviewSession
        fields = [
            "id",
            "deckId",
            "totalCards",
            "reviewedCount",
            "correctCount",
            "metadata",
            "startedAt",
            "completedAt",
        ]

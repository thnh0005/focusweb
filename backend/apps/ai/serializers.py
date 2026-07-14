from django.conf import settings
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
    sourceFileUrl = serializers.SerializerMethodField()
    canReadInline = serializers.SerializerMethodField()
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
            "sourceFileUrl",
            "canReadInline",
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
            "sourceFileUrl",
            "canReadInline",
            "status",
            "uploadedAt",
            "processedAt",
        ]

    def get_hasSummary(self, instance) -> bool:
        return instance.summaries.exists()

    def get_hasFlashcards(self, instance) -> bool:
        return instance.flashcard_decks.filter(cards__isnull=False).distinct().exists()

    def get_sourceFileUrl(self, instance) -> str:
        source_path = ((instance.metadata or {}).get("source_file") or {}).get("path")
        if not source_path:
            return ""
        return f"/api/documents/{instance.id}/file/"

    def get_canReadInline(self, instance) -> bool:
        source_path = ((instance.metadata or {}).get("source_file") or {}).get("path")
        return bool(source_path or instance.extracted_text)


class DocumentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        file_type = infer_file_type(value.name)
        if file_type not in ALLOWED_DOCUMENT_TYPES:
            raise serializers.ValidationError("Only PDF, DOCX, and TXT files are supported.")
        if value.size > settings.DOCUMENT_MAX_UPLOAD_SIZE_BYTES:
            raise serializers.ValidationError("File must be 10 MB or smaller.")
        content_type = (getattr(value, "content_type", "") or "").split(";")[0].strip().lower()
        if content_type and content_type not in settings.DOCUMENT_ALLOWED_MIME_TYPES:
            raise serializers.ValidationError("File MIME type is not supported.")
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
    mode = serializers.CharField(required=True)
    force = serializers.BooleanField(required=False, default=False)

    def validate_mode(self, value):
        normalized = str(value or "").strip()
        if normalized == "key-points":
            normalized = DocumentSummary.Mode.KEY_POINTS
        if normalized not in {
            DocumentSummary.Mode.KEY_POINTS,
            DocumentSummary.Mode.DETAILED,
        }:
            raise serializers.ValidationError("Invalid summary mode.")
        return normalized


class DocumentSummarySerializer(serializers.ModelSerializer):
    documentId = serializers.UUIDField(source="document_id", read_only=True)
    document_id = serializers.UUIDField(read_only=True)
    input_checksum = serializers.CharField(read_only=True)
    model_name = serializers.CharField(read_only=True)
    structured_content = serializers.JSONField(read_only=True)
    source_character_count = serializers.IntegerField(read_only=True)
    source_word_count = serializers.IntegerField(read_only=True)
    chunk_count = serializers.IntegerField(read_only=True)
    source_truncated = serializers.BooleanField(read_only=True)
    error_code = serializers.CharField(read_only=True)
    error_message = serializers.CharField(read_only=True)
    generated_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = DocumentSummary
        fields = [
            "id",
            "documentId",
            "document_id",
            "mode",
            "status",
            "content",
            "structured_content",
            "input_checksum",
            "model_name",
            "provider",
            "source",
            "prompt_version",
            "source_character_count",
            "source_word_count",
            "chunk_count",
            "source_truncated",
            "generation_attempts",
            "error_code",
            "error_message",
            "generated_at",
            "created_at",
            "updated_at",
        ]


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
    scope = serializers.JSONField(required=True)
    page_start = serializers.IntegerField(required=False)
    page_end = serializers.IntegerField(required=False)
    section_start = serializers.IntegerField(required=False)
    section_end = serializers.IntegerField(required=False)
    quantity = serializers.IntegerField(
        min_value=5,
        max_value=20,
        default=10,
    )
    difficulty = serializers.ChoiceField(
        choices=FlashcardDeck.Difficulty.choices,
        default=FlashcardDeck.Difficulty.MEDIUM,
    )
    force = serializers.BooleanField(required=False, default=False)
    page_range = serializers.DictField(required=False)
    pageRange = serializers.DictField(required=False)

    def validate(self, attrs):
        scope = attrs.get("scope")
        if isinstance(scope, dict):
            scope_type = scope.get("type")
            attrs["scope"] = scope_type
            if scope.get("start") is not None:
                attrs.setdefault("page_start", scope.get("start"))
                attrs.setdefault("section_start", scope.get("start"))
            if scope.get("end") is not None:
                attrs.setdefault("page_end", scope.get("end"))
                attrs.setdefault("section_end", scope.get("end"))
        if attrs.get("scope") not in {"full_document", "page_range", "section"}:
            raise serializers.ValidationError({"scope": "Invalid flashcard scope."})
        if attrs["scope"] == "page_range":
            if attrs.get("page_start") is None or attrs.get("page_end") is None:
                raise serializers.ValidationError({"page_range": "page_start and page_end are required."})
        if attrs["scope"] == "section":
            if attrs.get("section_start") is None or attrs.get("section_end") is None:
                raise serializers.ValidationError({"section": "section_start and section_end are required."})
        if attrs["scope"] == "full_document":
            attrs["page_start"] = None
            attrs["page_end"] = None
            attrs["section_start"] = None
            attrs["section_end"] = None
        attrs["page_range"] = attrs.get("page_range") or attrs.get("pageRange") or {}
        attrs.pop("pageRange", None)
        return attrs


class FlashcardDeckSerializer(serializers.ModelSerializer):
    documentId = serializers.UUIDField(source="document_id", read_only=True)
    pageRange = serializers.JSONField(source="page_range", read_only=True)
    scope = serializers.SerializerMethodField()
    requestedQuantity = serializers.IntegerField(source="requested_quantity", read_only=True)
    generatedQuantity = serializers.IntegerField(source="generated_quantity", read_only=True)
    generationFingerprint = serializers.CharField(source="generation_fingerprint", read_only=True)
    sourceChecksum = serializers.CharField(source="source_checksum", read_only=True)
    sourceCharacterCount = serializers.IntegerField(source="source_character_count", read_only=True)
    sourceTruncated = serializers.BooleanField(source="source_truncated", read_only=True)
    modelName = serializers.CharField(source="model_name", read_only=True)
    promptVersion = serializers.CharField(source="prompt_version", read_only=True)
    errorCode = serializers.CharField(source="error_code", read_only=True)
    errorMessage = serializers.CharField(source="error_message", read_only=True)
    cards = FlashcardSerializer(many=True, read_only=True)
    createdAt = serializers.SerializerMethodField()
    generatedAt = serializers.SerializerMethodField()
    retryAt = serializers.SerializerMethodField()
    retryAfterSeconds = serializers.SerializerMethodField()
    processingStartedAt = serializers.SerializerMethodField()

    def get_scope(self, obj):
        scope = dict(obj.scope or {})
        scope.pop("processing_context", None)
        return scope

    def get_createdAt(self, obj):
        return obj.generated_at

    def get_generatedAt(self, obj):
        if obj.status in {FlashcardDeck.Status.COMPLETED, FlashcardDeck.Status.PARTIAL}:
            return obj.generated_at
        return None

    def get_retryAt(self, obj):
        return ((obj.scope or {}).get("processing_context") or {}).get("retry_at")

    def get_retryAfterSeconds(self, obj):
        return ((obj.scope or {}).get("processing_context") or {}).get("retry_after_seconds")

    def get_processingStartedAt(self, obj):
        return ((obj.scope or {}).get("processing_context") or {}).get("processing_started_at")

    class Meta:
        model = FlashcardDeck
        fields = [
            "id",
            "documentId",
            "title",
            "quantity",
            "requestedQuantity",
            "generatedQuantity",
            "difficulty",
            "status",
            "pageRange",
            "scope",
            "generationFingerprint",
            "sourceChecksum",
            "sourceCharacterCount",
            "sourceTruncated",
            "modelName",
            "provider",
            "promptVersion",
            "generation_attempts",
            "errorCode",
            "errorMessage",
            "cards",
            "createdAt",
            "generatedAt",
            "retryAt",
            "retryAfterSeconds",
            "processingStartedAt",
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

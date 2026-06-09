import uuid

from django.conf import settings
from django.db import models


class StudyDocument(models.Model):
    """Lưu metadata và text đã trích xuất cho thư viện tài liệu tuần 3."""

    class FileType(models.TextChoices):
        PDF = "pdf", "PDF"
        DOCX = "docx", "DOCX"
        TXT = "txt", "TXT"

    class Status(models.TextChoices):
        UPLOADED = "uploaded", "Uploaded"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        ERROR = "error", "Error"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="study_documents",
    )
    filename = models.CharField(max_length=255)
    original_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=8, choices=FileType.choices)
    file_size_bytes = models.PositiveIntegerField(default=0)
    page_count = models.PositiveIntegerField(default=0)
    extracted_text = models.TextField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.UPLOADED,
    )
    metadata = models.JSONField(default=dict, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-uploaded_at"]
        indexes = [
            models.Index(fields=["user", "uploaded_at"]),
            models.Index(fields=["user", "file_type"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return self.original_name


class DocumentSummary(models.Model):
    """Giữ summary fallback để Dev2 có thể thay bằng AI summary sau."""

    class Mode(models.TextChoices):
        KEY_POINTS = "key-points", "Key points"
        DETAILED = "detailed", "Detailed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        StudyDocument,
        on_delete=models.CASCADE,
        related_name="summaries",
    )
    mode = models.CharField(max_length=16, choices=Mode.choices)
    content = models.TextField()
    source = models.CharField(max_length=32, default="server-fallback")
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-generated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "mode"],
                name="unique_document_summary_mode",
            ),
        ]

    def __str__(self):
        return f"{self.document_id}: {self.mode}"


class FlashcardDeck(models.Model):
    """Lưu deck flashcard theo document để review session đọc lại ổn định."""

    class Difficulty(models.TextChoices):
        EASY = "easy", "Easy"
        MEDIUM = "medium", "Medium"
        HARD = "hard", "Hard"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="flashcard_decks",
    )
    document = models.ForeignKey(
        StudyDocument,
        on_delete=models.CASCADE,
        related_name="flashcard_decks",
    )
    title = models.CharField(max_length=160, blank=True)
    quantity = models.PositiveSmallIntegerField(default=0)
    difficulty = models.CharField(
        max_length=12,
        choices=Difficulty.choices,
        default=Difficulty.MEDIUM,
    )
    page_range = models.JSONField(default=dict, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-generated_at"]
        indexes = [
            models.Index(fields=["user", "generated_at"]),
            models.Index(fields=["document", "generated_at"]),
        ]

    def __str__(self):
        return self.title or f"Deck: {self.document.original_name}"


class Flashcard(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deck = models.ForeignKey(
        FlashcardDeck,
        on_delete=models.CASCADE,
        related_name="cards",
    )
    document = models.ForeignKey(
        StudyDocument,
        on_delete=models.CASCADE,
        related_name="flashcards",
    )
    question = models.CharField(max_length=500)
    answer = models.TextField(max_length=5000)
    difficulty = models.CharField(
        max_length=12,
        choices=FlashcardDeck.Difficulty.choices,
        default=FlashcardDeck.Difficulty.MEDIUM,
    )
    page_reference = models.CharField(max_length=80, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["deck", "order"],
                name="unique_flashcard_order_per_deck",
            ),
        ]

    def __str__(self):
        return self.question


class FlashcardReviewSession(models.Model):
    """Ghi nhận một lượt review để tuần sau có thể tính tiến độ học tập."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="flashcard_review_sessions",
    )
    deck = models.ForeignKey(
        FlashcardDeck,
        on_delete=models.CASCADE,
        related_name="review_sessions",
    )
    total_cards = models.PositiveSmallIntegerField(default=0)
    reviewed_count = models.PositiveSmallIntegerField(default=0)
    correct_count = models.PositiveSmallIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["user", "started_at"])]

    def __str__(self):
        return f"Review {self.deck_id}"

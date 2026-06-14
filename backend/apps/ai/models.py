import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class AIAnalysisResult(models.Model):
    class FocusState(models.TextChoices):
        FOCUSED = "focused", "Focused"
        POTENTIALLY_DISTRACTED = (
            "potentially_distracted",
            "Potentially Distracted",
        )
        DISTRACTED = "distracted", "Distracted"
        UNKNOWN = "unknown", "Unknown"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_id = models.UUIDField()
    browser_event_id = models.UUIDField(null=True, blank=True)
    provider = models.CharField(max_length=100, blank=True)
    model_name = models.CharField(max_length=100, blank=True)
    session_goal = models.TextField(blank=True)
    page_title = models.CharField(max_length=500, blank=True)
    domain = models.CharField(max_length=255, blank=True)
    content_snippet = models.TextField(blank=True)
    relevance_score = models.FloatField(default=0.0)
    is_relevant = models.BooleanField(default=False)
    focus_state = models.CharField(
        max_length=32,
        choices=FocusState.choices,
        default=FocusState.UNKNOWN,
    )
    reason = models.TextField(blank=True)
    raw_response = models.JSONField(default=dict, blank=True)
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["session_id", "created_at"]),
            models.Index(fields=["relevance_score"]),
            models.Index(fields=["focus_state"]),
            models.Index(fields=["is_relevant"]),
        ]

    def __str__(self):
        return (
            f"AI {self.relevance_score:.2f} "
            f"{self.focus_state}: {self.session_id}"
        )


class SessionInsight(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    class Source(models.TextChoices):
        AI = "AI", "AI"
        RULE_BASED_FALLBACK = "RULE_BASED_FALLBACK", "Rule-based fallback"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.OneToOneField(
        "focus_sessions.FocusSession",
        on_delete=models.CASCADE,
        related_name="ai_insight",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    observations = models.JSONField(default=list, blank=True)
    source = models.CharField(
        max_length=32,
        choices=Source.choices,
        blank=True,
    )
    model_name = models.CharField(max_length=100, blank=True)
    retry_count = models.PositiveSmallIntegerField(default=0)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "updated_at"]),
        ]

    def __str__(self):
        return f"Session insight {self.session_id}: {self.status}"


class StudyDocument(models.Model):
    """Store uploaded study-document metadata and extracted text."""

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
    """Persist document summaries so the API has a stable read contract."""

    class Mode(models.TextChoices):
        KEY_POINTS = "key_points", "Key points"
        DETAILED = "detailed", "Detailed"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        STALE = "stale", "Stale"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        StudyDocument,
        on_delete=models.CASCADE,
        related_name="summaries",
    )
    mode = models.CharField(max_length=16, choices=Mode.choices)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    content = models.TextField(blank=True)
    structured_content = models.JSONField(default=dict, blank=True)
    input_checksum = models.CharField(max_length=64, blank=True)
    model_name = models.CharField(max_length=100, blank=True)
    provider = models.CharField(max_length=100, blank=True)
    prompt_version = models.CharField(max_length=32, blank=True)
    source = models.CharField(max_length=32, default="ai")
    source_character_count = models.PositiveIntegerField(default=0)
    source_word_count = models.PositiveIntegerField(default=0)
    chunk_count = models.PositiveSmallIntegerField(default=0)
    source_truncated = models.BooleanField(default=False)
    generation_attempts = models.PositiveSmallIntegerField(default=0)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-generated_at"]
        indexes = [
            models.Index(fields=["document", "mode", "status"]),
            models.Index(fields=["input_checksum"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "mode"],
                name="unique_document_summary_mode",
            ),
        ]

    def __str__(self):
        return f"{self.document_id}: {self.mode}"


class FlashcardDeck(models.Model):
    """Persist generated flashcard decks for a study document."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        PARTIAL = "partial", "Partial"
        FAILED = "failed", "Failed"
        STALE = "stale", "Stale"

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
    requested_quantity = models.PositiveSmallIntegerField(default=0)
    generated_quantity = models.PositiveSmallIntegerField(default=0)
    difficulty = models.CharField(
        max_length=12,
        choices=Difficulty.choices,
        default=Difficulty.MEDIUM,
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.COMPLETED,
    )
    page_range = models.JSONField(default=dict, blank=True)
    scope = models.JSONField(default=dict, blank=True)
    source_checksum = models.CharField(max_length=64, blank=True)
    generation_fingerprint = models.CharField(max_length=64, blank=True)
    model_name = models.CharField(max_length=100, blank=True)
    provider = models.CharField(max_length=100, blank=True)
    prompt_version = models.CharField(max_length=32, blank=True)
    source_character_count = models.PositiveIntegerField(default=0)
    source_truncated = models.BooleanField(default=False)
    generation_attempts = models.PositiveSmallIntegerField(default=0)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-generated_at"]
        indexes = [
            models.Index(fields=["user", "generated_at"]),
            models.Index(fields=["document", "generated_at"]),
            models.Index(fields=["generation_fingerprint"]),
            models.Index(fields=["document", "status"]),
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
    """Record a flashcard review session for progress tracking."""

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

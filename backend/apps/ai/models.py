import uuid

from django.conf import settings
from django.core.files.storage import default_storage
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

    def delete(self, *args, **kwargs):
        source_path = ((self.metadata or {}).get("source_file") or {}).get("path")
        super().delete(*args, **kwargs)
        if source_path and default_storage.exists(source_path):
            default_storage.delete(source_path)


class AITokenCalibration(models.Model):
    provider = models.CharField(max_length=64)
    model = models.CharField(max_length=160)
    operation = models.CharField(max_length=64)
    prompt_version = models.CharField(max_length=64)
    sample_count = models.PositiveIntegerField(default=0)
    p95_ratio = models.FloatField(default=1.0)
    fixed_overhead_tokens = models.PositiveIntegerField(default=0)
    window_size = models.PositiveIntegerField(default=200)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "model", "operation", "prompt_version"],
                name="unique_ai_token_calibration_scope",
            ),
        ]
        indexes = [
            models.Index(fields=["provider", "model", "operation", "prompt_version"]),
        ]


class AIRequestUsage(models.Model):
    class Status(models.TextChoices):
        STARTED = "started", "Started"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job_id = models.CharField(max_length=100, blank=True)
    document = models.ForeignKey(
        StudyDocument,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ai_request_usages",
    )
    chunk_id = models.CharField(max_length=100, blank=True)
    provider = models.CharField(max_length=64)
    model = models.CharField(max_length=160)
    operation = models.CharField(max_length=64)
    prompt_version = models.CharField(max_length=64)
    payload_hash = models.CharField(max_length=64)
    tokenizer_name = models.CharField(max_length=200)
    local_prompt_tokens = models.PositiveIntegerField(default=0)
    calibration_ratio = models.FloatField(default=1.0)
    fixed_overhead_tokens = models.PositiveIntegerField(default=0)
    calibrated_prompt_tokens = models.PositiveIntegerField(default=0)
    reserved_output_tokens = models.PositiveIntegerField(default=0)
    estimated_total_tokens = models.PositiveIntegerField(default=0)
    actual_prompt_tokens = models.PositiveIntegerField(null=True, blank=True)
    actual_completion_tokens = models.PositiveIntegerField(null=True, blank=True)
    actual_total_tokens = models.PositiveIntegerField(null=True, blank=True)
    ratio = models.FloatField(null=True, blank=True)
    difference_tokens = models.IntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.STARTED,
    )
    attempt = models.PositiveSmallIntegerField(default=1)
    provider_request_id = models.CharField(max_length=160, blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    request_started_at = models.DateTimeField(null=True, blank=True)
    request_completed_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["provider", "model", "operation", "prompt_version", "created_at"]),
            models.Index(fields=["job_id", "created_at"]),
            models.Index(fields=["document", "created_at"]),
            models.Index(fields=["status"]),
        ]


class AITokenCalibrationSample(models.Model):
    calibration = models.ForeignKey(
        AITokenCalibration,
        on_delete=models.CASCADE,
        related_name="samples",
    )
    usage = models.OneToOneField(
        AIRequestUsage,
        on_delete=models.CASCADE,
        related_name="calibration_sample",
    )
    local_prompt_tokens = models.PositiveIntegerField()
    actual_prompt_tokens = models.PositiveIntegerField()
    ratio = models.FloatField()
    difference_tokens = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["calibration", "created_at"]),
        ]


class DocumentAIJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        EXTRACTING = "EXTRACTING", "Extracting"
        CHUNKING = "CHUNKING", "Chunking"
        PROCESSING_CHUNKS = "PROCESSING_CHUNKS", "Processing chunks"
        REDUCING = "REDUCING", "Reducing"
        GENERATING_SUMMARY = "GENERATING_SUMMARY", "Generating summary"
        GENERATING_FLASHCARDS = "GENERATING_FLASHCARDS", "Generating flashcards"
        FINALIZING = "FINALIZING", "Finalizing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    class NotificationStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SENT = "SENT", "Sent"
        SKIPPED = "SKIPPED", "Skipped"

    TERMINAL_STATUSES = {Status.COMPLETED, Status.FAILED, Status.CANCELLED}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.OneToOneField(
        StudyDocument,
        on_delete=models.CASCADE,
        related_name="ai_job",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="document_ai_jobs",
    )
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING)
    current_operation = models.CharField(max_length=64, blank=True)
    current_chunk_index = models.PositiveSmallIntegerField(default=0)
    total_chunks = models.PositiveSmallIntegerField(default=0)
    completed_chunks = models.PositiveSmallIntegerField(default=0)
    rolling_context_summary = models.TextField(blank=True)
    entity_memory_json = models.JSONField(default=dict, blank=True)
    open_context_json = models.JSONField(default=list, blank=True)
    chunk_summaries_json = models.JSONField(default=list, blank=True)
    flashcard_candidates_json = models.JSONField(default=list, blank=True)
    last_ai_request_at = models.DateTimeField(null=True, blank=True)
    next_ai_request_at = models.DateTimeField(null=True, blank=True)
    summary_status = models.CharField(max_length=32, default="pending")
    flashcard_status = models.CharField(max_length=32, default="pending")
    notification_status = models.CharField(
        max_length=32,
        choices=NotificationStatus.choices,
        default=NotificationStatus.PENDING,
    )
    summary = models.ForeignKey(
        "ai.DocumentSummary",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ai_jobs",
    )
    flashcard_deck = models.ForeignKey(
        "ai.FlashcardDeck",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ai_jobs",
    )
    source_checksum = models.CharField(max_length=64, blank=True)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["document", "status"]),
            models.Index(fields=["status", "next_ai_request_at"]),
        ]


class DocumentAIChunk(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        RETRY_SCHEDULED = "RETRY_SCHEDULED", "Retry scheduled"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        DocumentAIJob,
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    chunk_index = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    text = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    partial_result = models.JSONField(default=dict, blank=True)
    updated_context_summary = models.TextField(blank=True)
    provider_request_usage = models.ForeignKey(
        AIRequestUsage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="document_ai_chunks",
    )
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["chunk_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["job", "chunk_index"],
                name="unique_document_ai_chunk_index",
            ),
        ]
        indexes = [
            models.Index(fields=["job", "status", "chunk_index"]),
        ]


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
        constraints = [
            models.UniqueConstraint(
                fields=["generation_fingerprint"],
                condition=~models.Q(generation_fingerprint=""),
                name="unique_flashcard_generation_fingerprint",
            ),
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

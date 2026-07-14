import mimetypes

from django.core.files.storage import default_storage
from django.db import transaction
from django.http import FileResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import DocumentAIJob, DocumentSummary, FlashcardDeck, FlashcardReviewSession
from .models import StudyDocument
from .serializers import (
    CreateReviewSessionSerializer,
    DocumentSummarySerializer,
    DocumentUploadSerializer,
    FlashcardDeckSerializer,
    FlashcardDeckUpdateSerializer,
    FlashcardReviewSessionSerializer,
    GenerateFlashcardsSerializer,
    GenerateSummarySerializer,
    StudyDocumentSerializer,
    StudyDocumentUpdateSerializer,
)
from .services.document_extraction import build_storage_filename, infer_file_type
from .services.document_summary import DocumentSummaryError, DocumentSummaryService
from .services.document_ai_flow import progress_payload
from .services.extraction_queue import schedule_document_extraction_after_commit
from .services.flashcard_generation import FlashcardGenerationError, FlashcardGenerationService
from .tasks import generate_document_flashcards, generate_document_summary


def get_owned_document(user, document_id):
    """Chỉ trả tài liệu thuộc user hiện tại để tránh lộ tài liệu học tập."""
    try:
        return (
            StudyDocument.objects.filter(user=user)
            .prefetch_related("summaries", "flashcard_decks__cards")
            .get(pk=document_id)
        )
    except (StudyDocument.DoesNotExist, ValueError) as exc:
        raise NotFound("Document was not found.") from exc


def get_owned_deck(user, deck_id):
    """Chỉ lấy deck của user hiện tại; id của user khác được giấu bằng 404."""
    try:
        return FlashcardDeck.objects.prefetch_related("cards").get(
            pk=deck_id,
            user=user,
        )
    except (FlashcardDeck.DoesNotExist, ValueError) as exc:
        raise NotFound("Flashcard deck was not found.") from exc


def create_document_from_upload(user, uploaded_file):
    original_name = uploaded_file.name
    file_type = infer_file_type(original_name)
    filename = build_storage_filename(original_name, file_type)

    source_path = default_storage.save(
        f"study-documents/{user.id}/{filename}",
        uploaded_file,
    )
    metadata = {
        "source_file": {
            "path": source_path,
            "content_type": getattr(uploaded_file, "content_type", "") or "",
        },
        "extraction": {
            "status": "pending",
            "error_code": "",
            "error_message": "",
            "queued_at": timezone.now().isoformat(),
        },
    }

    return StudyDocument.objects.create(
        user=user,
        filename=filename,
        original_name=original_name,
        file_type=file_type,
        file_size_bytes=getattr(uploaded_file, "size", 0) or 0,
        page_count=0,
        extracted_text="",
        metadata=metadata,
        status=StudyDocument.Status.UPLOADED,
        processed_at=None,
    )


def enqueue_document_extraction(document):
    schedule_document_extraction_after_commit(
        str(document.id),
        previous_status=document.status,
        recovery_action="upload_enqueue",
        attempt=0,
    )


class DocumentListView(GenericAPIView):
    serializer_class = StudyDocumentSerializer

    @extend_schema(operation_id="document_list", responses=StudyDocumentSerializer(many=True))
    def get(self, request):
        # API tuần 3 cho thư viện tài liệu: filter nhẹ để frontend search/sort.
        documents = StudyDocument.objects.filter(user=request.user).prefetch_related(
            "summaries",
            "flashcard_decks__cards",
        )
        search = request.query_params.get("search")
        file_type = request.query_params.get("fileType")
        sort_by = request.query_params.get("sortBy", "date")
        sort_order = request.query_params.get("sortOrder", "desc")
        limit = request.query_params.get("limit")

        if search:
            documents = documents.filter(original_name__icontains=search)
        if file_type and file_type != "all":
            documents = documents.filter(file_type=file_type)

        ordering_map = {
            "date": "uploaded_at",
            "name": "original_name",
            "size": "file_size_bytes",
        }
        ordering = ordering_map.get(sort_by, "uploaded_at")
        if sort_order != "asc":
            ordering = f"-{ordering}"
        documents = documents.order_by(ordering)
        if limit:
            try:
                limit_value = max(1, min(int(limit), 50))
            except (TypeError, ValueError):
                raise ValidationError({"limit": ["Limit must be a positive integer."]})
            documents = documents[:limit_value]
        return Response(StudyDocumentSerializer(documents, many=True).data)

    @extend_schema(
        operation_id="document_create",
        request=DocumentUploadSerializer,
        responses=StudyDocumentSerializer,
    )
    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            document = create_document_from_upload(request.user, serializer.validated_data["file"])
            enqueue_document_extraction(document)
        return Response(
            StudyDocumentSerializer(document).data,
            status=status.HTTP_201_CREATED,
        )


class DocumentUploadView(GenericAPIView):
    serializer_class = StudyDocumentSerializer
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        operation_id="document_upload",
        request=DocumentUploadSerializer,
        responses=StudyDocumentSerializer,
    )
    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            document = create_document_from_upload(request.user, serializer.validated_data["file"])
            enqueue_document_extraction(document)
        return Response(
            StudyDocumentSerializer(document).data,
            status=status.HTTP_201_CREATED,
        )


class DocumentAIJobStatusView(GenericAPIView):
    @extend_schema(operation_id="document_ai_job_status")
    def get(self, request, document_id):
        document = get_owned_document(request.user, document_id)
        job = DocumentAIJob.objects.filter(document=document, user=request.user).first()
        if job is None:
            return Response(
                {
                    "status": "not_started",
                    "document_id": str(document.id),
                    "job_id": None,
                    "message": "Document AI job has not been requested.",
                }
            )
        return Response(progress_payload(job))


class DocumentDetailView(GenericAPIView):
    serializer_class = StudyDocumentSerializer

    @extend_schema(operation_id="document_retrieve", responses=StudyDocumentSerializer)
    def get(self, request, document_id):
        return Response(StudyDocumentSerializer(get_owned_document(request.user, document_id)).data)

    @extend_schema(
        operation_id="document_update",
        request=StudyDocumentUpdateSerializer,
        responses=StudyDocumentSerializer,
    )
    def patch(self, request, document_id):
        document = get_owned_document(request.user, document_id)
        serializer = StudyDocumentUpdateSerializer(document, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        document.refresh_from_db()
        return Response(StudyDocumentSerializer(document).data)

    @extend_schema(operation_id="document_delete")
    def delete(self, request, document_id):
        get_owned_document(request.user, document_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentFileView(GenericAPIView):
    @extend_schema(operation_id="document_source_file")
    def get(self, request, document_id):
        document = get_owned_document(request.user, document_id)
        source_info = (document.metadata or {}).get("source_file") or {}
        source_path = source_info.get("path")
        if not source_path or not default_storage.exists(source_path):
            raise NotFound("Document source file was not found.")

        content_type = (
            source_info.get("content_type")
            or
            mimetypes.guess_type(document.original_name)[0]
            or "application/octet-stream"
        )
        return FileResponse(
            default_storage.open(source_path, "rb"),
            as_attachment=False,
            filename=document.original_name,
            content_type=content_type,
        )


class DocumentSourceTextView(GenericAPIView):
    @extend_schema(operation_id="document_source_text")
    def get(self, request, document_id):
        document = get_owned_document(request.user, document_id)
        return Response(
            {
                "text": document.extracted_text,
                "fileType": document.file_type,
                "filename": document.original_name,
            }
        )


class DocumentSummaryView(GenericAPIView):
    serializer_class = DocumentSummarySerializer

    def summary_payload(self, summary, document, cached=False):
        data = DocumentSummarySerializer(summary).data
        if summary.status != DocumentSummary.Status.COMPLETED:
            data["content"] = None
            data["structured_content"] = {}
        return {
            "status": summary.status,
            "cached": cached,
            "document_id": str(document.id),
            "extraction_status": (document.metadata or {}).get("extraction", {}).get(
                "status",
                document.status,
            ),
            "summary": data,
        }

    def summary_lookup(self, document, mode):
        summary = DocumentSummary.objects.filter(document=document, mode=mode).first()
        if summary is None:
            return {
                "id": "",
                "documentId": str(document.id),
                "document_id": str(document.id),
                "mode": mode,
                "status": "not_generated",
                "content": None,
                "structured_content": {},
                "input_checksum": "",
                "model_name": "",
                "provider": "",
                "source": "ai",
                "prompt_version": "",
                "source_character_count": 0,
                "source_word_count": 0,
                "chunk_count": 0,
                "source_truncated": False,
                "generation_attempts": 0,
                "error_code": "",
                "error_message": "",
                "generated_at": None,
                "created_at": None,
                "updated_at": None,
                "stale": False,
            }
        data = DocumentSummarySerializer(summary).data
        if summary.status != DocumentSummary.Status.COMPLETED:
            data["content"] = None
            data["structured_content"] = {}
        current_checksum = DocumentSummaryService().current_checksum(document)
        data["stale"] = bool(
            (summary.input_checksum and summary.input_checksum != current_checksum)
            or (summary.prompt_version and summary.prompt_version != DocumentSummaryService().prompt_builder.PROMPT_VERSION)
        )
        return data

    def parse_mode(self, value, required=False):
        if value in (None, ""):
            if required:
                raise ValidationError({"mode": ["This field is required."]})
            return None
        if value == "key-points":
            return DocumentSummary.Mode.KEY_POINTS
        if value not in {DocumentSummary.Mode.KEY_POINTS, DocumentSummary.Mode.DETAILED}:
            raise ValidationError({"mode": ["Invalid summary mode."]})
        return value

    @extend_schema(operation_id="document_summary_retrieve", responses=DocumentSummarySerializer)
    def get(self, request, document_id):
        document = get_owned_document(request.user, document_id)
        mode = self.parse_mode(request.query_params.get("mode"))
        if mode:
            data = self.summary_lookup(document, mode)
            extraction_status = (document.metadata or {}).get("extraction", {}).get(
                "status",
                document.status,
            )
            return Response(
                {
                    **data,
                    "document_id": str(document.id),
                    "documentId": str(document.id),
                    "extraction_status": extraction_status,
                    "summary": data,
                }
            )
        return Response(
            {
                "document_id": str(document.id),
                "extraction_status": (document.metadata or {}).get("extraction", {}).get(
                    "status",
                    document.status,
                ),
                "summaries": {
                    DocumentSummary.Mode.KEY_POINTS: self.summary_lookup(
                        document,
                        DocumentSummary.Mode.KEY_POINTS,
                    ),
                    DocumentSummary.Mode.DETAILED: self.summary_lookup(
                        document,
                        DocumentSummary.Mode.DETAILED,
                    ),
                },
            }
        )

    @extend_schema(
        operation_id="document_summary_generate",
        request=GenerateSummarySerializer,
        responses=DocumentSummarySerializer,
    )
    def post(self, request, document_id):
        document = get_owned_document(request.user, document_id)
        serializer = GenerateSummarySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mode = serializer.validated_data["mode"]
        force = serializer.validated_data.get("force", False)
        try:
            result = DocumentSummaryService().request_summary(document, mode, force=force)
        except DocumentSummaryError as exc:
            return Response(exc.response_data(), status=exc.status_code)

        if result.should_enqueue:
            transaction.on_commit(
                lambda: generate_document_summary.delay(str(document.id), mode, force=force)
            )
            return Response(
                self.summary_payload(result.summary, document, cached=False),
                status=status.HTTP_202_ACCEPTED,
            )
        return Response(
            self.summary_payload(result.summary, document, cached=result.cached),
            status=status.HTTP_200_OK,
        )


class DocumentFlashcardsView(GenericAPIView):
    serializer_class = FlashcardDeckSerializer

    @extend_schema(operation_id="document_flashcards", responses=FlashcardDeckSerializer)
    def get(self, request, document_id):
        document = get_owned_document(request.user, document_id)
        deck = (
            FlashcardDeck.objects.filter(document=document, user=document.user)
            .filter(status__in=[FlashcardDeck.Status.PENDING, FlashcardDeck.Status.PROCESSING])
            .prefetch_related("cards")
            .order_by("-updated_at")
            .first()
        )
        if deck is None:
            deck = (
                FlashcardDeck.objects.filter(document=document, user=document.user)
                .prefetch_related("cards")
                .order_by("-generated_at")
                .first()
            )
        if deck is None:
            return Response(
                {
                    "status": "not_generated",
                    "cached": False,
                    "reused": False,
                    "document_id": str(document.id),
                    "deck": None,
                }
            )
        cached = deck.status in {FlashcardDeck.Status.COMPLETED, FlashcardDeck.Status.PARTIAL}
        return Response(
            {
                "status": deck.status,
                "cached": cached,
                "reused": deck.status in {FlashcardDeck.Status.PENDING, FlashcardDeck.Status.PROCESSING},
                "document_id": str(document.id),
                "deck": FlashcardDeckSerializer(deck).data,
            }
        )

    @extend_schema(
        operation_id="document_flashcards_generate",
        request=GenerateFlashcardsSerializer,
        responses=FlashcardDeckSerializer,
    )
    def post(self, request, document_id):
        document = get_owned_document(request.user, document_id)
        data = {"scope": "full_document", **request.data}
        serializer = GenerateFlashcardsSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        config = FlashcardGenerationService().normalize_config(serializer.validated_data)
        force = config.pop("force", False)
        try:
            result = FlashcardGenerationService().request_generation(
                document,
                config,
                force=force,
            )
        except FlashcardGenerationError as exc:
            return Response(exc.response_data(), status=exc.status_code)

        payload = DocumentFlashcardsGenerateView().deck_payload(
            result.deck,
            document,
            cached=result.cached,
            reused=result.reused,
        )
        if result.should_enqueue:
            task_config = {**config, "force": False}
            transaction.on_commit(
                lambda: generate_document_flashcards.delay(
                    str(document.id),
                    task_config,
                    force=False,
                )
            )
            return Response(payload, status=status.HTTP_202_ACCEPTED)
        return Response(payload, status=status.HTTP_200_OK)


class DocumentFlashcardsGenerateView(GenericAPIView):
    serializer_class = FlashcardDeckSerializer

    def deck_payload(self, deck, document, cached=False, reused=False):
        data = FlashcardDeckSerializer(deck).data
        if deck.status not in {FlashcardDeck.Status.COMPLETED, FlashcardDeck.Status.PARTIAL}:
            data["cards"] = []
        return {
            "status": deck.status,
            "cached": cached,
            "reused": reused,
            "document_id": str(document.id),
            "deck": data,
        }

    @extend_schema(
        operation_id="document_flashcards_generate_alias",
        request=GenerateFlashcardsSerializer,
        responses=FlashcardDeckSerializer,
    )
    def post(self, request, document_id):
        document = get_owned_document(request.user, document_id)
        serializer = GenerateFlashcardsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = FlashcardGenerationService().normalize_config(serializer.validated_data)
        force = config.pop("force", False)
        try:
            result = FlashcardGenerationService().request_generation(
                document,
                config,
                force=force,
            )
        except FlashcardGenerationError as exc:
            return Response(exc.response_data(), status=exc.status_code)

        if result.should_enqueue:
            task_config = {**config, "force": False}
            transaction.on_commit(
                lambda: generate_document_flashcards.delay(
                    str(document.id),
                    task_config,
                    force=False,
                )
            )
            return Response(
                self.deck_payload(result.deck, document, cached=False, reused=result.reused),
                status=status.HTTP_202_ACCEPTED,
            )
        return Response(
            self.deck_payload(result.deck, document, cached=result.cached, reused=result.reused),
            status=status.HTTP_200_OK,
        )


class FlashcardDeckListView(GenericAPIView):
    serializer_class = FlashcardDeckSerializer

    @extend_schema(operation_id="flashcard_deck_list", responses=FlashcardDeckSerializer(many=True))
    def get(self, request):
        decks = FlashcardDeck.objects.filter(user=request.user).prefetch_related("cards")
        return Response(FlashcardDeckSerializer(decks, many=True).data)


class FlashcardDeckDetailView(GenericAPIView):
    serializer_class = FlashcardDeckSerializer

    @extend_schema(operation_id="flashcard_deck_retrieve", responses=FlashcardDeckSerializer)
    def get(self, request, deck_id):
        return Response(FlashcardDeckSerializer(get_owned_deck(request.user, deck_id)).data)

    @extend_schema(
        operation_id="flashcard_deck_update",
        request=FlashcardDeckUpdateSerializer,
        responses=FlashcardDeckSerializer,
    )
    def patch(self, request, deck_id):
        deck = get_owned_deck(request.user, deck_id)
        serializer = FlashcardDeckUpdateSerializer(deck, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        deck.refresh_from_db()
        return Response(FlashcardDeckSerializer(deck).data)

    @extend_schema(operation_id="flashcard_deck_delete")
    def delete(self, request, deck_id):
        get_owned_deck(request.user, deck_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FlashcardReviewSessionView(GenericAPIView):
    serializer_class = FlashcardReviewSessionSerializer

    @extend_schema(
        operation_id="flashcard_review_session_create",
        request=CreateReviewSessionSerializer,
        responses=FlashcardReviewSessionSerializer,
    )
    def post(self, request, deck_id):
        deck = get_owned_deck(request.user, deck_id)
        serializer = CreateReviewSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        total_cards = deck.cards.count()
        reviewed_ids = set(data.get("reviewed_card_ids", []))
        correct_ids = set(data.get("correct_card_ids", []))
        reviewed_count = min(len(reviewed_ids), total_cards) if reviewed_ids else 0
        correct_count = min(len(correct_ids), reviewed_count) if correct_ids else 0
        completed_at = timezone.now() if total_cards and reviewed_count >= total_cards else None
        review = FlashcardReviewSession.objects.create(
            user=request.user,
            deck=deck,
            total_cards=total_cards,
            reviewed_count=reviewed_count,
            correct_count=correct_count,
            completed_at=completed_at,
            metadata=data.get("metadata", {}),
        )
        return Response(
            FlashcardReviewSessionSerializer(review).data,
            status=status.HTTP_201_CREATED,
        )

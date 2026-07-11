from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import DocumentSummary, Flashcard, FlashcardDeck, FlashcardReviewSession
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
from .services.document_parser import extract_document_metadata, text_chunks_for_flashcards
from .services.document_summary import DocumentSummaryError, DocumentSummaryService
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


def build_summary_content(document, mode):
    text = document.extracted_text.strip()
    if not text:
        return "No extracted text is available for this document yet."

    chunks = text_chunks_for_flashcards(text, 6)
    if mode == DocumentSummary.Mode.KEY_POINTS:
        return "\n".join(f"- {chunk[:220]}" for chunk in chunks)

    excerpt = "\n\n".join(chunks[:4])
    return f"### {document.original_name}\n\n{excerpt}"


def get_or_create_summary(document, mode):
    # Summary AI thuộc Dev2. Dev1 lưu fallback để UI có contract ổn định.
    summary, _ = DocumentSummary.objects.get_or_create(
        document=document,
        mode=mode,
        defaults={
            "content": build_summary_content(document, mode),
            "status": DocumentSummary.Status.COMPLETED,
            "source": "rule_based_fallback",
            "provider": "rule_based",
            "generated_at": timezone.now(),
        },
    )
    return summary


@transaction.atomic
def create_fallback_flashcard_deck(document, quantity=5, difficulty="medium", page_range=None):
    """Tạo deck rule-based tối thiểu; Dev2 có thể thay bằng AI generator."""
    chunks = text_chunks_for_flashcards(document.extracted_text, quantity)
    deck = FlashcardDeck.objects.create(
        user=document.user,
        document=document,
        title=f"{document.original_name} review",
        quantity=len(chunks),
        generated_quantity=len(chunks),
        difficulty=difficulty,
        page_range=page_range or {},
        provider="rule_based",
        prompt_version="rule_based_v1",
    )
    cards = [
        Flashcard(
            deck=deck,
            document=document,
            question=f"What is key idea {index + 1} from this document?",
            answer=chunk[:1000],
            difficulty=difficulty,
            page_reference="",
            order=index,
        )
        for index, chunk in enumerate(chunks)
    ]
    Flashcard.objects.bulk_create(cards)
    return FlashcardDeck.objects.prefetch_related("cards").get(pk=deck.pk)


def latest_or_fallback_deck(document):
    deck = (
        FlashcardDeck.objects.filter(document=document, user=document.user)
        .prefetch_related("cards")
        .order_by("-generated_at")
        .first()
    )
    if deck:
        return deck
    return create_fallback_flashcard_deck(document)


def create_document_from_upload(user, uploaded_file):
    try:
        data = extract_document_metadata(uploaded_file)
    except ValueError as exc:
        raise ValidationError({"file": [str(exc)]}) from exc

    return StudyDocument.objects.create(
        user=user,
        status=StudyDocument.Status.READY,
        processed_at=timezone.now(),
        **data,
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
        return Response(StudyDocumentSerializer(documents, many=True).data)

    @extend_schema(
        operation_id="document_create",
        request=DocumentUploadSerializer,
        responses=StudyDocumentSerializer,
    )
    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = create_document_from_upload(request.user, serializer.validated_data["file"])
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
        document = create_document_from_upload(request.user, serializer.validated_data["file"])
        return Response(
            StudyDocumentSerializer(document).data,
            status=status.HTTP_201_CREATED,
        )


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
            summary = get_or_create_summary(document, mode)
        data = DocumentSummarySerializer(summary).data
        if summary.status != DocumentSummary.Status.COMPLETED:
            data["content"] = None
            data["structured_content"] = {}
        current_checksum = DocumentSummaryService().current_checksum(document)
        data["stale"] = bool(summary.input_checksum and summary.input_checksum != current_checksum)
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
        return Response(FlashcardDeckSerializer(latest_or_fallback_deck(document)).data)

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
        values = serializer.validated_data
        deck = create_fallback_flashcard_deck(
            document,
            quantity=values["quantity"],
            difficulty=values["difficulty"],
            page_range=values.get("page_range") or {},
        )
        return Response(FlashcardDeckSerializer(deck).data, status=status.HTTP_201_CREATED)


class DocumentFlashcardsGenerateView(GenericAPIView):
    serializer_class = FlashcardDeckSerializer

    def deck_payload(self, deck, document, cached=False):
        data = FlashcardDeckSerializer(deck).data
        if deck.status not in {FlashcardDeck.Status.COMPLETED, FlashcardDeck.Status.PARTIAL}:
            data["cards"] = []
        return {
            "status": deck.status,
            "cached": cached,
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
            task_config = {**config, "force": force}
            transaction.on_commit(
                lambda: generate_document_flashcards.delay(
                    str(document.id),
                    task_config,
                    force=force,
                )
            )
            return Response(
                self.deck_payload(result.deck, document, cached=False),
                status=status.HTTP_202_ACCEPTED,
            )
        return Response(
            self.deck_payload(result.deck, document, cached=result.cached),
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

from django.urls import path

from .views import (
    DocumentDetailView,
    DocumentFlashcardsView,
    DocumentFlashcardsGenerateView,
    DocumentListView,
    DocumentSummaryView,
    DocumentUploadView,
    FlashcardDeckDetailView,
    FlashcardDeckListView,
    FlashcardReviewSessionView,
)


urlpatterns = [
    path("documents/", DocumentListView.as_view(), name="document-list"),
    path("documents/upload/", DocumentUploadView.as_view(), name="document-upload"),
    path("documents/<uuid:document_id>/", DocumentDetailView.as_view(), name="document-detail"),
    path(
        "documents/<uuid:document_id>/summary/",
        DocumentSummaryView.as_view(),
        name="document-summary",
    ),
    path(
        "documents/<uuid:document_id>/flashcards/",
        DocumentFlashcardsView.as_view(),
        name="document-flashcards",
    ),
    path(
        "documents/<uuid:document_id>/flashcards/generate/",
        DocumentFlashcardsGenerateView.as_view(),
        name="document-flashcards-generate",
    ),
    path("flashcard-decks/", FlashcardDeckListView.as_view(), name="flashcard-deck-list"),
    path(
        "flashcard-decks/<uuid:deck_id>/",
        FlashcardDeckDetailView.as_view(),
        name="flashcard-deck-detail",
    ),
    path(
        "flashcard-decks/<uuid:deck_id>/review-session/",
        FlashcardReviewSessionView.as_view(),
        name="flashcard-review-session",
    ),
]

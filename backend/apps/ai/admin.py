from django.contrib import admin

from .models import (
    AIAnalysisResult,
    DocumentSummary,
    Flashcard,
    FlashcardDeck,
    FlashcardReviewSession,
    SessionInsight,
    StudyDocument,
)


admin.site.register(AIAnalysisResult)
admin.site.register(DocumentSummary)
admin.site.register(Flashcard)
admin.site.register(FlashcardDeck)
admin.site.register(FlashcardReviewSession)
admin.site.register(SessionInsight)
admin.site.register(StudyDocument)

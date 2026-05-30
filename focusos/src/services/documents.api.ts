import { apiClient } from "./client";
import type {
  StudyDocument,
  DocumentSummary,
  FlashcardDeck,
  SummaryMode,
  GenerateSummaryPayload,
  GenerateFlashcardsPayload,
  DocumentFilters,
} from "@/types/document.types";

export const documentsApi = {
  /**
   * Fetch documents inside user library.
   */
  getDocuments(filters?: DocumentFilters): Promise<StudyDocument[]> {
    return apiClient.get<StudyDocument[]>("/documents/", {
      params: filters as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Upload a textbook or lecture notes file (PDF, DOCX, TXT).
   */
  uploadDocument(file: File): Promise<StudyDocument> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.upload<StudyDocument>("/documents/upload/", formData);
  },

  /**
   * Fetch a generated summary by document ID and mode.
   */
  getDocumentSummary(docId: string, mode: SummaryMode): Promise<DocumentSummary> {
    return apiClient.get<DocumentSummary>(`/documents/${docId}/summary/`, {
      params: { mode },
    });
  },

  /**
   * Trigger AI summarization.
   */
  generateDocumentSummary(payload: GenerateSummaryPayload): Promise<DocumentSummary> {
    return apiClient.post<DocumentSummary>(`/documents/${payload.documentId}/summary/`, {
      mode: payload.mode,
    });
  },

  /**
   * Fetch a generated flashcard deck for study document.
   */
  getFlashcardDeck(docId: string): Promise<FlashcardDeck> {
    return apiClient.get<FlashcardDeck>(`/documents/${docId}/flashcards/`);
  },

  /**
   * Trigger AI generation of study flashcards.
   */
  generateFlashcards(payload: GenerateFlashcardsPayload): Promise<FlashcardDeck> {
    return apiClient.post<FlashcardDeck>(`/documents/${payload.documentId}/flashcards/`, {
      quantity: payload.quantity,
      difficulty: payload.difficulty,
      page_range: payload.pageRange
        ? {
            start_page: payload.pageRange.startPage,
            end_page: payload.pageRange.endPage,
          }
        : undefined,
    });
  },

  /**
   * Remove textbook notes from the user library.
   */
  deleteDocument(docId: string): Promise<void> {
    return apiClient.delete<void>(`/documents/${docId}/`);
  },
};

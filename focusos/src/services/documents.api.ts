import { apiClient } from "./client";
import type {
  StudyDocument,
  DocumentSummary,
  DocumentSummaryResponse,
  FlashcardDeck,
  SummaryMode,
  GenerateSummaryPayload,
  GenerateFlashcardsPayload,
  GenerateFlashcardsResponse,
  DocumentFilters,
} from "@/types/document.types";

type GenerateFlashcardsRequestBody = {
  scope: "full_document" | "page_range" | "section";
  quantity: number;
  difficulty: GenerateFlashcardsPayload["difficulty"];
  force?: boolean;
  page_start?: number;
  page_end?: number;
  section_start?: number;
  section_end?: number;
};

function unwrapDocumentSummary(response: DocumentSummaryResponse | DocumentSummary): DocumentSummary {
  if ("summary" in response) {
    if (!response.summary) {
      throw new Error("Document summary is not available yet.");
    }

    return {
      ...response.summary,
      documentId:
        response.summary.documentId ??
        response.documentId ??
        response.summary.document_id ??
        response.document_id ??
        "",
      generatedAt: response.summary.generatedAt ?? response.summary.generated_at ?? null,
      errorCode: response.summary.errorCode ?? response.summary.error_code,
      errorMessage: response.summary.errorMessage ?? response.summary.error_message,
      modelName: response.summary.modelName ?? response.summary.model_name,
    };
  }

  return {
    ...response,
    generatedAt: response.generatedAt ?? response.generated_at ?? null,
    errorCode: response.errorCode ?? response.error_code,
    errorMessage: response.errorMessage ?? response.error_message,
    modelName: response.modelName ?? response.model_name,
  };
}

function buildGenerateFlashcardsBody(payload: GenerateFlashcardsPayload): GenerateFlashcardsRequestBody {
  const body: GenerateFlashcardsRequestBody = {
    scope: payload.scope ?? "full_document",
    quantity: payload.quantity,
    difficulty: payload.difficulty,
  };

  if (payload.force !== undefined) {
    body.force = payload.force;
  }

  if (payload.scope === "page_range") {
    body.page_start = payload.pageRange.startPage;
    body.page_end = payload.pageRange.endPage;
  }

  if (payload.scope === "section") {
    body.section_start = payload.sectionRange.startSection;
    body.section_end = payload.sectionRange.endSection;
  }

  return body;
}

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

  getDocument(docId: string): Promise<StudyDocument> {
    return apiClient.get<StudyDocument>(`/documents/${docId}/`);
  },

  /**
   * Fetch a generated summary by document ID and mode.
   */
  async getDocumentSummary(docId: string, mode: SummaryMode): Promise<DocumentSummary> {
    const response = await apiClient.get<DocumentSummaryResponse | DocumentSummary>(`/documents/${docId}/summary/`, {
      params: { mode },
    });
    return unwrapDocumentSummary(response);
  },

  /**
   * Trigger AI summarization.
   */
  async generateDocumentSummary(payload: GenerateSummaryPayload): Promise<DocumentSummary> {
    const response = await apiClient.post<DocumentSummaryResponse | DocumentSummary>(`/documents/${payload.documentId}/summary/`, {
      mode: payload.mode,
      force: payload.force ?? false,
    });
    return unwrapDocumentSummary(response);
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
  async generateFlashcards(payload: GenerateFlashcardsPayload): Promise<FlashcardDeck> {
    const response = await apiClient.post<GenerateFlashcardsResponse>(
      `/documents/${encodeURIComponent(payload.documentId)}/flashcards/generate/`,
      buildGenerateFlashcardsBody(payload)
    );

    return response.deck;
  },

  /**
   * Remove textbook notes from the user library.
   */
  deleteDocument(docId: string): Promise<void> {
    return apiClient.delete<void>(`/documents/${docId}/`);
  },
};

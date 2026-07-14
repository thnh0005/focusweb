import { apiClient, API_BASE_URL } from "./client";
import type {
  StudyDocument,
  DocumentSourceText,
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
      structuredContent:
        response.summary.structuredContent ?? response.summary.structured_content ?? {},
      errorCode: response.summary.errorCode ?? response.summary.error_code,
      errorMessage: response.summary.errorMessage ?? response.summary.error_message,
      modelName: response.summary.modelName ?? response.summary.model_name,
    };
  }

  return {
    ...response,
    generatedAt: response.generatedAt ?? response.generated_at ?? null,
    structuredContent: response.structuredContent ?? response.structured_content ?? {},
    errorCode: response.errorCode ?? response.error_code,
    errorMessage: response.errorMessage ?? response.error_message,
    modelName: response.modelName ?? response.model_name,
  };
}

function emptyFlashcardDeck(docId: string): FlashcardDeck {
  return {
    id: "",
    documentId: docId,
    title: "",
    quantity: 0,
    requestedQuantity: 0,
    generatedQuantity: 0,
    difficulty: "medium",
    status: "not_generated",
    pageRange: undefined,
    scope: {},
    cards: [],
    createdAt: null,
    generatedAt: null,
  };
}

function unwrapFlashcardDeck(
  docId: string,
  response: GenerateFlashcardsResponse | FlashcardDeck
): FlashcardDeck {
  const normalize = (deck: FlashcardDeck, fallbackDocId: string): FlashcardDeck => ({
    ...deck,
    documentId:
      deck.documentId ??
      (deck as FlashcardDeck & { document_id?: string }).document_id ??
      fallbackDocId,
    generatedAt:
      deck.generatedAt ??
      (deck as FlashcardDeck & { generated_at?: string | null }).generated_at ??
      null,
    createdAt:
      deck.createdAt ??
      (deck as FlashcardDeck & { created_at?: string | null }).created_at ??
      null,
    errorCode: deck.errorCode ?? (deck as FlashcardDeck & { error_code?: string }).error_code,
    errorMessage: deck.errorMessage ?? (deck as FlashcardDeck & { error_message?: string }).error_message,
    modelName: deck.modelName ?? (deck as FlashcardDeck & { model_name?: string }).model_name,
    cards: deck.cards ?? [],
  });

  if ("deck" in response) {
    if (!response.deck) {
      return emptyFlashcardDeck(response.documentId || response.document_id || docId);
    }
    return normalize(response.deck, response.documentId || response.document_id || docId);
  }
  return normalize(response, docId);
}

function buildApiUrl(endpoint: string) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
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

  async getDocumentFileBlob(docId: string): Promise<Blob> {
    const response = await fetch(buildApiUrl(`/documents/${docId}/file/`), {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`Document source file could not be loaded (${response.status}).`);
    }
    return response.blob();
  },

  getDocumentSourceText(docId: string): Promise<DocumentSourceText> {
    return apiClient.get<DocumentSourceText>(`/documents/${docId}/text/`);
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
  async getFlashcardDeck(docId: string): Promise<FlashcardDeck> {
    const response = await apiClient.get<GenerateFlashcardsResponse | FlashcardDeck>(
      `/documents/${docId}/flashcards/`
    );
    return unwrapFlashcardDeck(docId, response);
  },

  /**
   * Trigger AI generation of study flashcards.
   */
  async generateFlashcards(payload: GenerateFlashcardsPayload): Promise<FlashcardDeck> {
    const response = await apiClient.post<GenerateFlashcardsResponse>(
      `/documents/${encodeURIComponent(payload.documentId)}/flashcards/generate/`,
      buildGenerateFlashcardsBody(payload)
    );

    return unwrapFlashcardDeck(payload.documentId, response);
  },

  /**
   * Remove textbook notes from the user library.
   */
  deleteDocument(docId: string): Promise<void> {
    return apiClient.delete<void>(`/documents/${docId}/`);
  },
};

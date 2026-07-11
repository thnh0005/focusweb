// ═══════════════════════════════════════════════════════════════
// Document Types — FocusOS (Study Tools)
// ═══════════════════════════════════════════════════════════════

// ── Document ──────────────────────────────────────────────────

export type DocumentFileType = "pdf" | "docx" | "txt";

export type DocumentStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "error";

export interface StudyDocument {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  fileType: DocumentFileType;
  fileSizeBytes: number;
  pageCount?: number;
  status: DocumentStatus;
  hasSummary: boolean;
  hasFlashcards: boolean;
  uploadedAt: string;
  processedAt?: string;
}

// ── Summary ───────────────────────────────────────────────────

export type SummaryMode = "key-points" | "key_points" | "detailed";

export type DocumentSummaryStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "stale";

export interface DocumentSummary {
  id: string;
  documentId: string;
  document_id?: string;
  mode: SummaryMode;
  status?: DocumentSummaryStatus;
  content: string | null; // Markdown formatted when completed
  generatedAt?: string | null;
  generated_at?: string | null;
  errorCode?: string;
  error_code?: string;
  errorMessage?: string;
  error_message?: string;
  provider?: string;
  source?: string;
  modelName?: string;
  model_name?: string;
  stale?: boolean;
  isStreaming?: boolean;
}

export interface DocumentSummaryResponse {
  status?: DocumentSummaryStatus;
  cached?: boolean;
  document_id?: string;
  documentId?: string;
  extraction_status?: string;
  summary: DocumentSummary | null;
}

export interface GenerateSummaryPayload {
  documentId: string;
  mode: SummaryMode;
  force?: boolean;
}

// ── Flashcard ─────────────────────────────────────────────────

export type FlashcardDifficulty = "easy" | "medium" | "hard";
export type FlashcardDeckStatus =
  | "pending"
  | "processing"
  | "completed"
  | "partial"
  | "failed"
  | "stale";

export interface Flashcard {
  id: string;
  documentId: string;
  deckId: string;
  question: string;
  answer: string;
  difficulty: FlashcardDifficulty;
  pageReference?: string;
  order: number;
}

export interface FlashcardDeck {
  id: string;
  documentId: string;
  title?: string;
  quantity: number;
  requestedQuantity?: number;
  generatedQuantity?: number;
  difficulty: FlashcardDifficulty;
  status?: FlashcardDeckStatus;
  pageRange?: FlashcardPageRange;
  scope?: Record<string, unknown>;
  generationFingerprint?: string;
  sourceChecksum?: string;
  sourceCharacterCount?: number;
  sourceTruncated?: boolean;
  modelName?: string;
  provider?: string;
  promptVersion?: string;
  generation_attempts?: number;
  errorCode?: string;
  errorMessage?: string;
  cards: Flashcard[];
  generatedAt: string;
}

export interface FlashcardPageRange {
  startPage: number;
  endPage: number;
}

export type FlashcardQuantity = 5 | 10 | 20 | number;

export interface FlashcardSectionRange {
  startSection: number;
  endSection: number;
}

interface GenerateFlashcardsBasePayload {
  documentId: string;
  quantity: FlashcardQuantity;
  difficulty: FlashcardDifficulty;
  force?: boolean;
}

export type GenerateFlashcardsPayload =
  | (GenerateFlashcardsBasePayload & {
      scope?: "full_document";
    })
  | (GenerateFlashcardsBasePayload & {
      scope: "page_range";
      pageRange: FlashcardPageRange;
    })
  | (GenerateFlashcardsBasePayload & {
      scope: "section";
      sectionRange: FlashcardSectionRange;
    });

export interface GenerateFlashcardsResponse {
  status: FlashcardDeckStatus;
  cached: boolean;
  document_id: string;
  deck: FlashcardDeck;
}

// ── Review Session ────────────────────────────────────────────

export interface FlashcardReviewState {
  deckId: string;
  currentIndex: number;
  totalCards: number;
  isRevealed: boolean;
  reviewedCardIds: string[];
  startedAt: Date;
  isComplete: boolean;
}

// ── Upload ────────────────────────────────────────────────────

export interface DocumentUploadPayload {
  file: File;
}

export interface DocumentUploadResponse {
  document: StudyDocument;
  message: string;
}

// ── Library Filters ───────────────────────────────────────────

export interface DocumentFilters {
  search?: string;
  fileType?: DocumentFileType | "all";
  sortBy?: "date" | "name" | "size";
  sortOrder?: "asc" | "desc";
}

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

export type SummaryMode = "key-points" | "detailed";

export interface DocumentSummary {
  id: string;
  documentId: string;
  mode: SummaryMode;
  content: string; // Markdown formatted
  generatedAt: string;
  isStreaming?: boolean;
}

export interface GenerateSummaryPayload {
  documentId: string;
  mode: SummaryMode;
}

// ── Flashcard ─────────────────────────────────────────────────

export type FlashcardDifficulty = "easy" | "medium" | "hard";

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
  quantity: number;
  difficulty: FlashcardDifficulty;
  pageRange?: FlashcardPageRange;
  cards: Flashcard[];
  generatedAt: string;
}

export interface FlashcardPageRange {
  startPage: number;
  endPage: number;
}

export type FlashcardQuantity = 5 | 10 | 20 | number;

export interface GenerateFlashcardsPayload {
  documentId: string;
  quantity: FlashcardQuantity;
  difficulty: FlashcardDifficulty;
  pageRange?: FlashcardPageRange;
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

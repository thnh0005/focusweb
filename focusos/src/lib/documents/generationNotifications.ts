import { useDocumentGenerationStore } from "@/stores/document-generation.store";
import { useNotificationStore } from "@/stores/notification.store";
import type {
  DocumentSummary,
  FlashcardDeck,
  StudyDocument,
  SummaryMode,
} from "@/types/document.types";

function documentName(documentName: string) {
  return documentName.trim() || "Tài liệu";
}

function notifyReady(options: {
  id: string;
  title: string;
  body: string;
  href: string;
}) {
  const { addNotification, addToast } = useNotificationStore.getState();
  addNotification({
    id: options.id,
    type: "ai_insight",
    title: options.title,
    body: options.body,
    href: options.href,
  });
  addToast({
    type: "success",
    title: options.title,
    message: options.body,
    duration: 6000,
  });
}

function notifyFailed(options: {
  id: string;
  title: string;
  body: string;
  href: string;
}) {
  const { addNotification, addToast } = useNotificationStore.getState();
  addNotification({
    id: options.id,
    type: "system",
    title: options.title,
    body: options.body,
    href: options.href,
  });
  addToast({
    type: "error",
    title: options.title,
    message: options.body,
    duration: 7000,
  });
}

export function handleSummaryGenerationStatus(
  summary: DocumentSummary,
  document: Pick<StudyDocument, "id" | "originalName" | "filename">,
  mode: SummaryMode
) {
  const name = documentName(document.originalName || document.filename);
  const status = summary.status ?? (summary.content ? "completed" : undefined);
  const jobId = `summary:${document.id}:${mode}`;
  const href = `/study-tools/${document.id}?tab=summary&mode=${mode}`;

  if (status === "completed" || Boolean(summary.content?.trim())) {
    useDocumentGenerationStore.getState().removeJob(jobId);
    notifyReady({
      id: `doc-summary-ready-${document.id}-${mode}-${summary.generatedAt ?? summary.id}`,
      title: "Tóm tắt tài liệu đã sẵn sàng",
      body: name,
      href,
    });
    return;
  }

  if (status === "failed") {
    useDocumentGenerationStore.getState().removeJob(jobId);
    notifyFailed({
      id: `doc-summary-failed-${document.id}-${mode}-${summary.id}`,
      title: "Tạo tóm tắt thất bại",
      body: summary.errorMessage || name,
      href,
    });
    return;
  }

  if (status === "pending" || status === "processing") {
    useDocumentGenerationStore.getState().watchJob({
      documentId: document.id,
      documentName: name,
      kind: "summary",
      mode,
    });
  }
}

export function handleFlashcardsGenerationStatus(
  deck: FlashcardDeck,
  document: Pick<StudyDocument, "id" | "originalName" | "filename">
) {
  const name = documentName(document.originalName || document.filename);
  const status = deck.status;
  const jobId = `flashcards:${document.id}:default`;
  const href = `/study-tools/${document.id}?tab=flashcards`;
  const hasCards = deck.cards.length > 0;

  if (status === "completed" || status === "partial" || hasCards) {
    useDocumentGenerationStore.getState().removeJob(jobId);
    notifyReady({
      id: `doc-flashcards-ready-${document.id}-${deck.generatedAt ?? deck.id}`,
      title: "Thẻ ghi nhớ đã sẵn sàng",
      body: name,
      href,
    });
    return;
  }

  if (status === "failed") {
    useDocumentGenerationStore.getState().removeJob(jobId);
    notifyFailed({
      id: `doc-flashcards-failed-${document.id}-${deck.id}`,
      title: "Tạo thẻ ghi nhớ thất bại",
      body: deck.errorMessage || name,
      href,
    });
    return;
  }

  if (status === "pending" || status === "processing") {
    useDocumentGenerationStore.getState().watchJob({
      documentId: document.id,
      documentName: name,
      kind: "flashcards",
    });
  }
}

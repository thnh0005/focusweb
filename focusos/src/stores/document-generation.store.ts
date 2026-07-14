import { create } from "zustand";
import type { SummaryMode } from "@/types/document.types";

export type DocumentGenerationJobKind = "summary" | "flashcards";

export interface DocumentGenerationJob {
  id: string;
  documentId: string;
  documentName: string;
  kind: DocumentGenerationJobKind;
  mode?: SummaryMode;
  createdAt: number;
}

export interface DocumentGenerationState {
  jobs: DocumentGenerationJob[];
  watchJob: (job: Omit<DocumentGenerationJob, "id" | "createdAt">) => void;
  removeJob: (id: string) => void;
}

function jobId(job: Omit<DocumentGenerationJob, "id" | "createdAt">) {
  return `${job.kind}:${job.documentId}:${job.mode ?? "default"}`;
}

export const useDocumentGenerationStore = create<DocumentGenerationState>((set) => ({
  jobs: [],

  watchJob: (job) => {
    const nextJob: DocumentGenerationJob = {
      ...job,
      id: jobId(job),
      createdAt: Date.now(),
    };

    set((state) => ({
      jobs: [
        nextJob,
        ...state.jobs.filter((item) => item.id !== nextJob.id),
      ].slice(0, 20),
    }));
  },

  removeJob: (id) => {
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== id),
    }));
  },
}));

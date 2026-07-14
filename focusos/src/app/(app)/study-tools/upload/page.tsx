"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BookOpen, FileText, Layers3, UploadCloud, X } from "lucide-react";
import { documentsApi } from "@/services/documents.api";
import { AmbientWorkspaceBackground } from "@/components/focus-home";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];
type UploadNextStep = "summary" | "flashcards" | "library";

function validateFile(file: File, t: (key: string) => string) {
  const lowerName = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));

  if (!hasAcceptedExtension) {
    return t("uploadPage.unsupported");
  }

  if (file.size > MAX_FILE_SIZE) {
    return t("uploadPage.tooLarge");
  }

  return "";
}

export default function UploadPage() {
  const { t } = useTranslation("documents");
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [nextStep, setNextStep] = React.useState<UploadNextStep>("summary");
  const [error, setError] = React.useState("");

  const uploadMutation = useMutation({
    retry: false,
    mutationFn: (selectedFile: File) => documentsApi.uploadDocument(selectedFile),
    onSuccess: (document) => {
      if (nextStep === "library") {
        router.push("/study-tools");
        return;
      }
      router.push(`/study-tools/${document.id}?tab=${nextStep}&intent=${nextStep}`);
    },
    onError: () => setError(t("uploadPage.failed")),
  });

  const chooseFile = (selectedFile: File | undefined) => {
    if (!selectedFile) return;
    const validationError = validateFile(selectedFile, t);
    setError(validationError);

    if (validationError) {
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  };

  const handleUpload = () => {
    if (!file || uploadMutation.isPending) return;
    uploadMutation.mutate(file);
  };

  return (
    <AmbientWorkspaceBackground className="min-h-[100dvh]">
      <main className="flex min-h-[100dvh] items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-3xl space-y-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("actions.backStudyDesk")}
          >
            <ArrowLeft className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </button>

          <header className="text-center">
            <p className="text-sm text-text-muted">{t("list.eyebrow")}</p>
            <h1 className="mt-2 text-4xl font-light text-text-primary">{t("uploadPage.title")}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-light leading-relaxed text-text-secondary">
              {t("uploadPage.description")}
            </p>
          </header>

          <section className="grid gap-2 sm:grid-cols-3" aria-label={t("uploadPage.flowAria")}>
            <FlowStep label={t("uploadPage.steps.upload")} active />
            <FlowStep label={t(`uploadPage.steps.${nextStep}`)} active={Boolean(file)} />
            <FlowStep label={t("uploadPage.steps.study")} active={uploadMutation.isPending} />
          </section>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-[2rem] border-2 border-dashed p-8 text-center transition-all duration-fast sm:p-12 ${
              isDragging
                ? "border-primary/60 bg-primary/10"
                : "border-white/14 bg-white/[0.035] hover:border-primary/40 hover:bg-white/[0.055]"
            }`}
            aria-label={t("uploadPage.chooseAria")}
          >
            <input
              ref={inputRef}
              type="file"
              onChange={(event) => chooseFile(event.target.files?.[0])}
              accept=".pdf,.docx,.txt"
              className="sr-only"
            />
            <UploadCloud className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
            <h2 className="mt-5 text-2xl font-light text-text-primary">{t("uploadPage.dropTitle")}</h2>
            <p className="mt-2 text-sm font-light text-text-secondary">
              {t("uploadPage.dropDescription")}
            </p>
          </Card>

          {error && (
            <div role="alert" className="rounded-2xl border border-urgency-amber/25 bg-urgency-amber/10 p-4 text-sm text-urgency-amber">
              {error}
            </div>
          )}

          {file && (
            <Card className="rounded-3xl p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-primary">
                    <FileText className="h-5 w-5 stroke-[1.6]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text-primary">{file.name}</p>
                    <p className="mt-1 text-sm text-text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-all hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("uploadPage.removeFile")}
                >
                  <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                </button>
              </div>
              {uploadMutation.isPending && (
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]" aria-label={t("uploadPage.uploadProgress")}>
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
                </div>
              )}
            </Card>
          )}

          <Card className="rounded-[1.75rem] p-4">
            <div className="flex flex-col gap-1 px-1">
              <p className="text-sm font-medium text-text-primary">{t("uploadPage.nextStepTitle")}</p>
              <p className="text-sm leading-6 text-text-secondary">{t("uploadPage.nextStepDescription")}</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("uploadPage.nextStepTitle")}>
              <NextStepButton
                active={nextStep === "summary"}
                icon={BookOpen}
                label={t("uploadPage.nextSteps.summary")}
                description={t("uploadPage.nextStepDescriptions.summary")}
                onClick={() => setNextStep("summary")}
              />
              <NextStepButton
                active={nextStep === "flashcards"}
                icon={Layers3}
                label={t("uploadPage.nextSteps.flashcards")}
                description={t("uploadPage.nextStepDescriptions.flashcards")}
                onClick={() => setNextStep("flashcards")}
              />
              <NextStepButton
                active={nextStep === "library"}
                icon={FileText}
                label={t("uploadPage.nextSteps.library")}
                description={t("uploadPage.nextStepDescriptions.library")}
                onClick={() => setNextStep("library")}
              />
            </div>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" className="h-12 flex-1 rounded-full" onClick={() => router.back()}>
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              variant="session"
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
              className="h-12 flex-1 rounded-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadMutation.isPending ? t("actions.uploading") : t(`uploadPage.submit.${nextStep}`)}
            </Button>
          </div>
        </div>
      </main>
    </AmbientWorkspaceBackground>
  );
}

function FlowStep({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm transition-colors ${
      active
        ? "border-primary/25 bg-primary/10 text-primary"
        : "border-white/10 bg-white/[0.035] text-text-muted"
    }`}>
      {label}
    </div>
  );
}

type NextStepIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function NextStepButton({
  active,
  icon: Icon,
  label,
  description,
  onClick,
}: {
  active: boolean;
  icon: NextStepIcon;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-2xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? "border-primary/35 bg-primary/[0.12] text-text-primary"
          : "border-white/10 bg-white/[0.035] text-text-secondary hover:bg-white/[0.06]"
      }`}
    >
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      <span className="mt-3 block text-sm font-medium">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-text-muted">{description}</span>
    </button>
  );
}

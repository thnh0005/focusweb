"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, FileText, UploadCloud, X } from "lucide-react";
import { documentsApi } from "@/services/documents.api";
import { AmbientScene } from "@/components/ambient/AmbientScene";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

function validateFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));

  if (!hasAcceptedExtension) {
    return "Upload a PDF, DOCX, or TXT file.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "File must be 10 MB or smaller.";
  }

  return "";
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState("");

  const uploadMutation = useMutation({
    mutationFn: (selectedFile: File) => documentsApi.uploadDocument(selectedFile),
    onSuccess: () => router.push("/study-tools"),
    onError: () => setError("Upload failed. Please try again."),
  });

  const chooseFile = (selectedFile: File | undefined) => {
    if (!selectedFile) return;
    const validationError = validateFile(selectedFile);
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
    <AmbientScene variant="rain" intensity="medium" className="min-h-[100dvh]">
      <main className="flex min-h-[100dvh] items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-3xl space-y-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-text-secondary transition-all duration-fast hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to study desk"
          >
            <ArrowLeft className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
          </button>

          <header className="text-center">
            <p className="text-sm text-text-muted">AI documents</p>
            <h1 className="mt-2 text-4xl font-light text-text-primary">Add an AI document</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-light leading-relaxed text-text-secondary">
              Drop source material into the desk. FocusOS will keep the upload flow simple and ready for study.
            </p>
          </header>

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
            aria-label="Choose an AI document file to upload"
          >
            <input
              ref={inputRef}
              type="file"
              onChange={(event) => chooseFile(event.target.files?.[0])}
              accept=".pdf,.docx,.txt"
              className="sr-only"
            />
            <UploadCloud className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
            <h2 className="mt-5 text-2xl font-light text-text-primary">Drop file here</h2>
            <p className="mt-2 text-sm font-light text-text-secondary">
              or browse your computer for PDF, DOCX, or TXT up to 10 MB
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
                  aria-label="Remove selected file"
                >
                  <X className="h-4 w-4 stroke-[1.6]" aria-hidden="true" />
                </button>
              </div>
              {uploadMutation.isPending && (
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]" aria-label="Upload in progress">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
                </div>
              )}
            </Card>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" className="h-12 flex-1 rounded-full" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="session"
              onClick={handleUpload}
              disabled={!file || uploadMutation.isPending}
              className="h-12 flex-1 rounded-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadMutation.isPending ? "Uploading" : "Upload and generate"}
            </Button>
          </div>
        </div>
      </main>
    </AmbientScene>
  );
}

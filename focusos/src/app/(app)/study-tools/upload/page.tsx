"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function UploadPage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    // TODO: Call API to upload document
    // For now, just navigate back
    setTimeout(() => {
      router.push("/study-tools");
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-extralight text-text-primary">
            Upload Document
          </h1>
          <p className="text-text-secondary font-light">
            Upload a PDF, DOCX, or TXT file to generate summaries and flashcards
          </p>
        </div>

        {/* Upload Zone */}
        <Card
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-12 border-2 border-dashed transition-colors cursor-pointer text-center space-y-4 ${
            isDragging
              ? "border-focus-purple bg-focus-purple/10"
              : "border-subtle-border hover:border-focus-purple/50"
          }`}
        >
          <div className="space-y-2">
            <p className="text-4xl">📄</p>
            <h2 className="text-lg font-medium text-text-primary">
              Drag and drop your file
            </h2>
            <p className="text-sm text-text-secondary font-light">
              or{" "}
              <label className="text-focus-purple hover:underline cursor-pointer">
                browse your computer
                <input
                  type="file"
                  onChange={handleFileInput}
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                />
              </label>
            </p>
            <p className="text-xs text-text-muted pt-2">
              PDF, DOCX, or TXT up to 10 MB
            </p>
          </div>
        </Card>

        {/* Selected File */}
        {file && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary truncate">
                  {file.name}
                </p>
                <p className="text-sm text-text-muted mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-text-muted hover:text-text-secondary text-sm ml-4"
              >
                Remove
              </button>
            </div>
          </Card>
        )}

        {/* Upload Button */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-subtle-border"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file}
            className="flex-1 bg-focus-purple hover:bg-focus-purple/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upload & Generate
          </Button>
        </div>
      </div>
    </div>
  );
}

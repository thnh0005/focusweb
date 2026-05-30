import React from "react";
import { Card } from "./Card";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "inline" | "fullpage";
}

export function ErrorState({
  title = "Something went wrong",
  description = "We encountered an error. Please try again or contact support.",
  action,
  variant = "inline",
}: ErrorStateProps) {
  if (variant === "fullpage") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center">
        <div className="text-6xl">⚠️</div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-2xl font-extralight text-text-primary">
            {title}
          </h2>
          <p className="text-sm text-text-secondary font-light leading-relaxed">
            {description}
          </p>
        </div>
        <div className="flex gap-3 pt-4">
          <Button
            onClick={() => window.location.reload()}
            className="bg-focus-purple hover:bg-focus-purple/90 text-white"
          >
            Retry
          </Button>
          {action && (
            <Button
              onClick={action.onClick}
              variant="outline"
              className="border-subtle-border text-text-primary hover:bg-surface-deep"
            >
              {action.label}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="p-6 bg-red-500/5 border border-red-500/20">
      <div className="flex gap-4">
        <div className="text-2xl flex-shrink-0">⚠️</div>
        <div className="flex-1">
          <h3 className="font-medium text-red-300">{title}</h3>
          <p className="text-sm text-red-200/70 font-light mt-1">
            {description}
          </p>
          {action && (
            <Button
              onClick={action.onClick}
              className="mt-3 bg-red-600 hover:bg-red-700 text-white text-sm"
            >
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

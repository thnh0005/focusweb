import React from "react";

interface LoadingStateProps {
  message?: string;
  variant?: "spinner" | "pulse";
}

export function LoadingState({
  message = "Loading...",
  variant = "spinner",
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      {variant === "spinner" ? (
        <div className="relative w-12 h-12">
          {/* SVG spinner */}
          <svg
            className="animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="rgba(168, 85, 247, 0.2)"
              strokeWidth="2"
            />
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
              stroke="rgb(168, 85, 247)"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              strokeDasharray="60"
              strokeDashoffset="0"
            />
          </svg>
        </div>
      ) : (
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-focus-purple animate-pulse"
              style={{
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
      )}
      <p className="text-sm text-text-secondary font-light">{message}</p>
    </div>
  );
}

export function PageLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <div className="relative w-16 h-16">
        <svg
          className="animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="rgba(168, 85, 247, 0.2)"
            strokeWidth="2"
          />
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
            stroke="rgb(168, 85, 247)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="60"
            strokeDashoffset="0"
          />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-text-primary font-light">Preparing your sanctuary...</p>
        <p className="text-xs text-text-muted font-light mt-2">
          FocusOS is loading
        </p>
      </div>
    </div>
  );
}

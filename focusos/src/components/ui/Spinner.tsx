import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-4 w-4 stroke-[2.5]",
  md: "h-6 w-6 stroke-2",
  lg: "h-8 w-8 stroke-[1.5]",
  xl: "h-12 w-12 stroke-[1.2]",
};

export function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className={cn(
        "animate-spin text-focus-purple",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
      />
      <path
        className="opacity-100"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

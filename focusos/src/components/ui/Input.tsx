import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  description?: string;
  isMonospace?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, description, isMonospace, ...props }, ref) => {
    return (
      <div className="flex flex-col space-y-1.5 w-full">
        {label && (
          <label className="text-xs font-medium text-text-secondary select-none tracking-wide">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all duration-120 ease-reveal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-40",
            isMonospace && "font-mono",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          ref={ref}
          {...props}
        />
        {description && !error && (
          <span className="text-xs text-text-muted font-light">{description}</span>
        )}
        {error && (
          <span className="text-xs text-urgency-coral font-light animate-fade-in">{error}</span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };

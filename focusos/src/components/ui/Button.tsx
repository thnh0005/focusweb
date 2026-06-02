import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.01] shadow-[0_12px_30px_rgba(109,92,232,0.25)]",
        secondary:
          "border border-subtle-border bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-elevated",
        outline:
          "border border-subtle-border bg-transparent text-text-primary hover:bg-bg-elevated",
        ghost:
          "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-surface",
        danger:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_0_20px_rgba(239,68,68,0.25)]",
        session:
          "btn-session text-text-primary hover:text-white hover:scale-[1.01]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

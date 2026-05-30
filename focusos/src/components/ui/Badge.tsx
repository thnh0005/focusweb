import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none uppercase",
  {
    variants: {
      variant: {
        default:
          "border-focus-purple/20 bg-focus-purple/10 text-focus-purple hover:bg-focus-purple/20",
        success:
          "border-focus-green/20 bg-focus-green/10 text-focus-green hover:bg-focus-green/20",
        warning:
          "border-urgency-amber/20 bg-urgency-amber/10 text-urgency-amber hover:bg-urgency-amber/20",
        danger:
          "border-urgency-coral/20 bg-urgency-coral/10 text-urgency-coral hover:bg-urgency-coral/20",
        info:
          "border-ambient-cyan/20 bg-ambient-cyan/10 text-ambient-cyan hover:bg-ambient-cyan/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

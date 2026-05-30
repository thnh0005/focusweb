import { cn } from "@/lib/utils/cn";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-surface-deep", className)}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-subtle-border p-6 space-y-4">
      <Skeleton className="h-6 w-32" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

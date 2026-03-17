"use client";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export default function Skeleton({
  className = "",
  variant = "text",
  width,
  height,
}: SkeletonProps) {
  const baseClasses = "animate-pulse bg-background-overlay rounded";

  const variantClasses = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-background-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="w-8 h-8" />
        <div className="space-y-1 flex-1">
          <Skeleton className="w-24 h-3" />
          <Skeleton className="w-16 h-2.5" />
        </div>
      </div>
      <Skeleton variant="rectangular" className="w-full h-64" />
      <div className="space-y-2">
        <Skeleton className="w-3/4 h-3" />
        <Skeleton className="w-1/2 h-3" />
      </div>
      <div className="flex gap-4 pt-2">
        <Skeleton className="w-16 h-6" />
        <Skeleton className="w-16 h-6" />
        <Skeleton className="w-16 h-6" />
      </div>
    </div>
  );
}

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
  const variantClasses = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  return (
    <div
      className={`relative overflow-hidden bg-background-overlay rounded ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-background-surface border border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="w-10 h-10" />
        <div className="space-y-2 flex-1">
          <Skeleton className="w-28 h-3.5" />
          <Skeleton className="w-16 h-2.5" />
        </div>
      </div>
      <Skeleton variant="rectangular" className="w-full h-72 rounded-xl" />
      <div className="flex gap-4 pt-1">
        <Skeleton className="w-20 h-8 rounded-lg" />
        <Skeleton className="w-20 h-8 rounded-lg" />
        <Skeleton className="w-20 h-8 rounded-lg" />
      </div>
    </div>
  );
}

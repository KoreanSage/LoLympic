import Skeleton, { CardSkeleton } from "@/components/ui/Skeleton";

export default function MainLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="w-32 h-8" />
        <Skeleton className="w-20 h-8" variant="rectangular" />
      </div>

      {/* Feed card skeletons */}
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

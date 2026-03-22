import Skeleton from "@/components/ui/Skeleton";

export default function PostLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Back button */}
      <Skeleton className="w-20 h-8" variant="rectangular" />

      {/* Post header */}
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="w-10 h-10" />
        <div className="space-y-1">
          <Skeleton className="w-28 h-4" />
          <Skeleton className="w-20 h-3" />
        </div>
      </div>

      {/* Post title */}
      <Skeleton className="w-3/4 h-6" />

      {/* Post image */}
      <Skeleton variant="rectangular" className="w-full h-80" />

      {/* Post body */}
      <div className="space-y-2">
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-5/6 h-4" />
        <Skeleton className="w-2/3 h-4" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 pt-2 border-t border-border">
        <Skeleton className="w-16 h-8" />
        <Skeleton className="w-16 h-8" />
        <Skeleton className="w-16 h-8" />
      </div>

      {/* Comments skeleton */}
      <div className="space-y-4 pt-4">
        <Skeleton className="w-24 h-5" />
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="w-20 h-3" />
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-3/4 h-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

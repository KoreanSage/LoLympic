export default function LeaderboardLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="h-7 w-48 bg-background-elevated rounded animate-pulse mx-auto" />
        <div className="h-4 w-32 bg-background-elevated rounded animate-pulse mx-auto" />
      </div>
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-background-elevated rounded-xl animate-pulse" />
        ))}
      </div>
      {/* Podium */}
      <div className="h-48 bg-background-elevated rounded-xl animate-pulse" />
      {/* Table rows */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-background-elevated rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

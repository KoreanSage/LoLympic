export default function SearchLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div className="h-7 w-32 bg-background-elevated rounded animate-pulse" />
      {/* Tabs */}
      <div className="flex gap-4 border-b border-border pb-2">
        <div className="h-5 w-16 bg-background-elevated rounded animate-pulse" />
        <div className="h-5 w-16 bg-background-elevated rounded animate-pulse" />
      </div>
      {/* Result cards */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-4 bg-background-elevated rounded-xl p-4 animate-pulse">
          <div className="w-20 h-20 rounded-lg bg-background-overlay flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-background-overlay rounded" />
            <div className="h-3 w-1/2 bg-background-overlay rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

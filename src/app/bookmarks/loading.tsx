export default function BookmarksLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div className="h-7 w-36 bg-background-elevated rounded animate-pulse" />
      {/* Bookmark cards */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-background-elevated rounded-xl p-4 animate-pulse space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-background-overlay" />
            <div className="h-3 w-24 bg-background-overlay rounded" />
          </div>
          <div className="h-64 bg-background-overlay rounded-lg" />
          <div className="flex gap-4">
            <div className="h-6 w-16 bg-background-overlay rounded" />
            <div className="h-6 w-16 bg-background-overlay rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

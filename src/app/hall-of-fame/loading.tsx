export default function HallOfFameLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="h-7 w-56 bg-background-elevated rounded animate-pulse mx-auto" />
        <div className="h-4 w-40 bg-background-elevated rounded animate-pulse mx-auto" />
      </div>
      {/* Champion cards */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-background-elevated rounded-xl animate-pulse p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-background-overlay animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-32 bg-background-overlay rounded animate-pulse" />
              <div className="h-3 w-24 bg-background-overlay rounded animate-pulse" />
            </div>
          </div>
          <div className="h-40 bg-background-overlay rounded-lg animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function TournamentLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="h-8 w-64 bg-background-elevated rounded animate-pulse mx-auto" />
        <div className="h-4 w-40 bg-background-elevated rounded animate-pulse mx-auto" />
      </div>
      {/* Tab switcher */}
      <div className="h-10 w-48 bg-background-elevated rounded-xl animate-pulse mx-auto" />
      {/* Bracket rows */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-48 bg-background-elevated rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

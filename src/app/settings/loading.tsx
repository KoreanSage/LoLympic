export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div className="h-7 w-28 bg-background-elevated rounded animate-pulse" />
      {/* Avatar section */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-background-elevated animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-32 bg-background-elevated rounded animate-pulse" />
          <div className="h-3 w-24 bg-background-elevated rounded animate-pulse" />
        </div>
      </div>
      {/* Form fields */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-20 bg-background-elevated rounded animate-pulse" />
          <div className="h-10 w-full bg-background-elevated rounded-lg animate-pulse" />
        </div>
      ))}
    </div>
  );
}

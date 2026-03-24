export default function UploadLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div className="h-7 w-40 bg-background-elevated rounded animate-pulse" />
      {/* Upload area */}
      <div className="h-64 bg-background-elevated rounded-xl animate-pulse border-2 border-dashed border-background-overlay" />
      {/* Form fields */}
      <div className="space-y-4">
        <div className="h-10 w-full bg-background-elevated rounded-lg animate-pulse" />
        <div className="h-24 w-full bg-background-elevated rounded-lg animate-pulse" />
        <div className="h-10 w-32 bg-background-elevated rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

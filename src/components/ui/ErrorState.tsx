"use client";

export default function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="text-center py-16">
      <p className="text-lg text-foreground-subtle mb-3">Oops</p>
      <p className="text-foreground font-medium mb-1">
        {message || "Something went wrong"}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-4 py-2 bg-[#c9a84c] text-black rounded-lg text-sm font-medium hover:opacity-90"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

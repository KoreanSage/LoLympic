export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md space-y-4">
        <svg
          className="w-16 h-16 mx-auto text-foreground-subtle"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728m2.829 9.9a5 5 0 010-7.072m7.072 7.072a5 5 0 000-7.072M13 12a1 1 0 11-2 0 1 1 0 012 0z"
          />
        </svg>
        <h1 className="text-2xl font-bold text-foreground">
          You&apos;re offline
        </h1>
        <p className="text-foreground-subtle">
          Check your internet connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-[#c9a84c] text-black hover:bg-[#b8963f] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

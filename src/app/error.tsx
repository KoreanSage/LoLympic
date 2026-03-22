"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1
          className="text-6xl font-bold mb-4"
          style={{ color: "#c9a84c" }}
        >
          Oops
        </h1>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Something went wrong
        </h2>
        <p className="text-foreground-subtle mb-8">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-lg font-medium text-white transition-colors"
            style={{ backgroundColor: "#c9a84c" }}
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-6 py-3 rounded-lg font-medium text-foreground border border-border transition-colors hover:bg-background-surface"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

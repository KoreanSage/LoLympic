"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          backgroundColor: "#0a0a0a",
          color: "#ededed",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "28rem" }}>
          <h1
            style={{
              fontSize: "3.75rem",
              fontWeight: 700,
              marginBottom: "1rem",
              color: "#c9a84c",
            }}
          >
            Oops
          </h1>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              color: "#999",
              marginBottom: "2rem",
            }}
          >
            {error.message || "A critical error occurred. Please try again."}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
            }}
          >
            <button
              onClick={reset}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                fontWeight: 500,
                color: "#fff",
                backgroundColor: "#c9a84c",
                border: "none",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Try Again
            </button>
            <a
              href="/"
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                fontWeight: 500,
                color: "#ededed",
                border: "1px solid #333",
                textDecoration: "none",
                fontSize: "1rem",
              }}
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

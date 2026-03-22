import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1
          className="text-8xl font-bold mb-4"
          style={{ color: "#c9a84c" }}
        >
          404
        </h1>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Page not found
        </h2>
        <p className="text-foreground-subtle mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-lg font-medium text-white transition-colors"
          style={{ backgroundColor: "#c9a84c" }}
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

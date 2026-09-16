"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <h1 className="text-lg font-semibold text-red-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-red-800">{error.message}</p>
      <p className="mt-3 text-xs text-red-700">
        Most often this means an environment variable is missing or the SQL migrations have not been run. See README.md → Setup.
      </p>
      <button onClick={reset} className="mt-4 rounded-md bg-red-900 px-3 py-1.5 text-sm text-white">
        Try again
      </button>
    </div>
  );
}

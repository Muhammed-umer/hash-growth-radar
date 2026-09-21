"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-red-200">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700">
          <TriangleAlert className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-red-900">Something went wrong</h1>
          <p className="mt-1 break-words text-sm text-red-800">{error.message}</p>
          <p className="mt-3 text-xs text-stone-600">
            Most often this means an environment variable is missing or the SQL migrations have not been run. See README.md → Setup.
          </p>
          <button
            onClick={reset}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-900"
          >
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

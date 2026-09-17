/**
 * Shown the instant a link is clicked while the next page is prepared on the
 * server, so a click never looks ignored.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse motion-reduce:animate-none">
      <div className="h-8 w-40 rounded-lg bg-stone-200" />
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
            <div className="h-3 w-1/3 rounded bg-stone-200" />
            <div className="mt-3 h-3 w-full rounded bg-stone-100" />
            <div className="mt-2 h-3 w-5/6 rounded bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

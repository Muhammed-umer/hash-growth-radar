/**
 * Shown the instant a link is clicked while the next page is prepared on the
 * server, so a click never looks ignored.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse motion-reduce:animate-none">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-xl bg-stone-200" />
        <div className="flex-1">
          <div className="h-7 w-40 rounded-lg bg-stone-200" />
          <div className="mt-2 h-3 w-2/3 rounded bg-stone-200/70" />
        </div>
      </div>
      <div className="mt-8 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <div className="size-12 shrink-0 rounded-xl bg-stone-100" />
            <div className="flex-1">
              <div className="h-3 w-1/3 rounded bg-stone-200" />
              <div className="mt-3 h-3 w-full rounded bg-stone-100" />
              <div className="mt-2 h-3 w-5/6 rounded bg-stone-100" />
              <div className="mt-4 flex gap-2">
                <div className="h-5 w-32 rounded-full bg-stone-100" />
                <div className="h-5 w-20 rounded-full bg-stone-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

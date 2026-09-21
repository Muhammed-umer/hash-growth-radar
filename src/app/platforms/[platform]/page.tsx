import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { NAV_PLATFORMS, PLATFORM_INFO, SHORTLIST } from "@/lib/config";
import { pageHref, STATUS_LABEL, timeAgo } from "@/lib/format";
import { loadQueuePage, MIN_SCORE_OPTIONS, parseIntent, parseMinScore, parsePage, parseQueueSort, parseTerm, recentDropped, tagFacets } from "@/lib/queries";
import { FilterBar } from "@/components/filter-bar";
import { ItemCard } from "@/components/item-card";
import { SortableList } from "@/components/sort-toggle";
import { Section } from "@/components/stat";

export const dynamic = "force-dynamic";

const PAGE_SIZE = SHORTLIST.page_size;

type NavPlatform = (typeof NAV_PLATFORMS)[number];

function isNavPlatform(p: string): p is NavPlatform {
  return (NAV_PLATFORMS as string[]).includes(p);
}

type Params = Record<string, string | string[] | undefined>;

export default async function PlatformPage({ params, searchParams }: { params: Promise<{ platform: string }>; searchParams: Promise<Params> }) {
  await requireUser();
  const { platform } = await params;
  if (!isNavPlatform(platform)) notFound();
  const info = PLATFORM_INFO[platform];

  const sp = await searchParams;
  const sort = parseQueueSort(sp.sort);
  const filter = { intent: parseIntent(sp.group), term: parseTerm(sp.term), minScore: parseMinScore(sp.min) };
  const requestedPage = parsePage(sp.page);

  const [{ entries, total }, facets, dropped] = await Promise.all([
    loadQueuePage({ platform, limit: PAGE_SIZE, offset: (requestedPage - 1) * PAGE_SIZE, sort, filter }),
    tagFacets(platform),
    recentDropped(platform, 8),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const now = new Date();
  const filtered = Boolean(filter.intent || filter.term || filter.minScore);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{info.label}</h1>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">Automatic: comments every 2 hours, new videos every 6, channels daily</span>
      </div>
      <p className="mt-1 max-w-3xl text-sm text-stone-600">{info.blurb}</p>
      <p className="mt-1 max-w-3xl text-sm text-stone-600">
        This page lists everyone found. The{" "}
        <Link href="/shortlist" className="underline">
          Shortlist
        </Link>{" "}
        shows only the best recent ones.
      </p>

      <section className="mt-8">
        <Suspense>
          <SortableList value={sort} title={<h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">People to look at ({total.toLocaleString()})</h2>}>
            <Suspense>
              <FilterBar intent={filter.intent} term={filter.term} minScore={filter.minScore} minScoreOptions={MIN_SCORE_OPTIONS} conditions={facets.conditions} medicines={facets.medicines} />
            </Suspense>

            {entries.length === 0 ? (
              <p className="mt-4 text-sm text-stone-500">{filtered ? "Nothing matches these filters." : `Nothing to look at on ${info.label} right now.`}</p>
            ) : (
              <>
                <p className="mt-4 text-xs text-stone-500">
                  Showing {from}–{to} of {total.toLocaleString()}
                  {filtered ? " matching" : ""}
                </p>
                <div className="mt-2 space-y-4">
                  {entries.map((e) => (
                    <ItemCard key={e.item.id} item={e.item} tag={e.tag} postedLabel={`posted ${timeAgo(e.item.posted_at ?? e.item.collected_at, now)}`} />
                  ))}
                </div>
                {pages > 1 && (
                  <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
                    {page > 1 ? (
                      <Link href={pageHref(sp, page - 1)} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50">
                        ← Previous
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span className="text-stone-500">
                      Page {page} of {pages}
                    </span>
                    {page < pages ? (
                      <Link href={pageHref(sp, page + 1)} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 hover:bg-stone-50">
                        Next →
                      </Link>
                    ) : (
                      <span />
                    )}
                  </nav>
                )}
              </>
            )}
          </SortableList>
        </Suspense>
      </section>

      <Section title="Recently dropped">
        {dropped.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing dropped yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white text-sm">
            {dropped.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start gap-2 px-3 py-2">
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">{STATUS_LABEL[d.status]}</span>
                <span className="text-xs text-stone-500">{d.filter_reason ?? "AI: not suitable to approach"}</span>
                <span className="w-full truncate text-stone-700">{d.title ?? d.body ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

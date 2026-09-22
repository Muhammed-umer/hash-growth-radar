import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Ban, ChevronDown, Info, SearchX, Timer, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { NAV_PLATFORMS, PLATFORM_INFO, SHORTLIST } from "@/lib/config";
import { dropReasonLabel, STATUS_LABEL, timeAgo } from "@/lib/format";
import { loadQueuePage, MIN_SCORE_OPTIONS, parseIntent, parseMinScore, parsePage, parseQueueSort, parseTerm, recentDropped, tagFacets } from "@/lib/queries";
import { FilterBar } from "@/components/filter-bar";
import { YouTubeIcon } from "@/components/icons";
import { ItemCard } from "@/components/item-card";
import { Pagination } from "@/components/pagination";
import { SortableList } from "@/components/sort-toggle";
import { PageHeader, Section } from "@/components/stat";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  return { title: isNavPlatform(platform) ? PLATFORM_INFO[platform].label : "Not found" };
}

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
    tagFacets(platform, filter),
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
      <PageHeader
        icon={<YouTubeIcon className="size-6" />}
        title={info.label}
        aside={
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200 sm:inline-flex">
            <Timer className="size-3.5" aria-hidden />
            Comments every 2 h · new videos every 6 h · channels daily
          </span>
        }
      >
        Everyone found on {info.label} who asked a question Hash can answer. The{" "}
        <Link href="/shortlist" className="font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:decoration-emerald-700">
          Shortlist
        </Link>{" "}
        shows only the best recent ones.
      </PageHeader>

      <details className="group mt-4 rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
        <summary className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-emerald-700">
          <Info className="size-4 text-emerald-700" aria-hidden />
          How this list is collected
          <ChevronDown className="ml-auto size-4 text-stone-400 transition group-open:rotate-180" aria-hidden />
        </summary>
        <p className="border-t border-stone-100 px-4 py-3 text-sm leading-relaxed text-stone-600">{info.blurb}</p>
      </details>

      <section className="mt-8">
        <Suspense>
          <SortableList
            value={sort}
            title={
              <h2 className="text-base font-semibold text-stone-900">
                People to look at <span className="ml-1 font-normal tabular-nums text-stone-600">{total.toLocaleString()}{filtered ? " matching" : ""}</span>
              </h2>
            }
          >
            <Suspense>
              <FilterBar
                intent={filter.intent}
                term={filter.term}
                minScore={filter.minScore}
                minScoreOptions={MIN_SCORE_OPTIONS}
                conditions={facets.conditions}
                medicines={facets.medicines}
                intents={facets.intents}
              />
            </Suspense>

            {entries.length === 0 ? (
              <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
                <SearchX className="size-8 text-stone-400" aria-hidden />
                <p className="mt-3 font-medium text-stone-800">{filtered ? "Nothing matches these filters" : `Nothing to look at on ${info.label} right now`}</p>
                {filtered && <p className="mt-1 text-sm text-stone-500">Try a lower minimum score or another group.</p>}
              </div>
            ) : (
              <>
                <p className="mt-5 text-xs text-stone-600">
                  Showing <span className="font-medium tabular-nums text-stone-700">{from}–{to}</span>
                </p>
                <div className="mt-2 space-y-4">
                  {entries.map((e) => (
                    <ItemCard key={e.item.id} item={e.item} tag={e.tag} postedLabel={`posted ${timeAgo(e.item.posted_at ?? e.item.collected_at, now)}`} />
                  ))}
                </div>
                <Pagination sp={sp} page={page} pages={pages} />
              </>
            )}
          </SortableList>
        </Suspense>
      </section>

      <Section title="Recently dropped" icon={Trash2} description="The last comments the keyword filter or the AI left out, and why. Shown without a link.">
        {dropped.length === 0 ? (
          <p className="text-sm text-stone-600">Nothing dropped yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white text-sm shadow-sm ring-1 ring-stone-200">
            {dropped.map((d) => (
              <li key={d.id} className="flex items-start gap-3 px-4 py-3">
                <Ban className="mt-0.5 size-4 shrink-0 text-stone-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-700">{STATUS_LABEL[d.status]}</span>
                    <span className="text-stone-500">{dropReasonLabel(d.filter_reason)}</span>
                  </div>
                  <p className="mt-1 truncate text-stone-700">{d.title ?? d.body ?? ""}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

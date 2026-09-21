"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cx, INTENT_LABEL } from "@/lib/format";
import type { Intent } from "@/lib/types";

export interface FilterBarProps {
  intent?: Intent;
  term?: string;
  minScore?: number;
  minScoreOptions: readonly number[];
  conditions: Array<[string, number]>;
  medicines: Array<[string, number]>;
  /** Rows per group under the other two filters. */
  intents: Partial<Record<Intent, number>>;
}

const GROUPS: Intent[] = ["medicine_food_question", "app_recommendation", "competitor_complaint", "nutrition_question"];

/**
 * Three dropdowns kept in the URL (?group=&term=&min=), so a refresh or a
 * shared link shows the same slice. Changing one resets the page to 1; the
 * sort toggle's ?sort= is left untouched. The counts in a dropdown are
 * computed under the OTHER dropdowns' choices (src/lib/queries.ts tagFacets),
 * so they say how many rows each option will give.
 */
export function FilterBar({ intent, term, minScore, minScoreOptions, conditions, medicines, intents }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(key: "group" | "term" | "min", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of ["group", "term", "min", "page"]) params.delete(k);
    startTransition(() => router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false }));
  }

  const active = Boolean(intent || term || minScore);
  const sel = "rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

  return (
    <div className={cx("flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3", pending && "opacity-70")} aria-busy={pending}>
      <label className="grid gap-1 text-xs text-stone-600">
        Group
        <select id="filter-group" className={sel} value={intent ?? ""} onChange={(e) => set("group", e.target.value)}>
          <option value="">All groups</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {INTENT_LABEL[g]} ({intents[g] ?? 0})
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-xs text-stone-600">
        Condition or medicine
        <select id="filter-term" className={sel} value={term ?? ""} onChange={(e) => set("term", e.target.value)}>
          <option value="">Any</option>
          {conditions.length > 0 && (
            <optgroup label="Conditions">
              {conditions.map(([c, n]) => (
                <option key={`c-${c}`} value={c}>
                  {c} ({n})
                </option>
              ))}
            </optgroup>
          )}
          {medicines.length > 0 && (
            <optgroup label="Medicines">
              {medicines.map(([m, n]) => (
                <option key={`m-${m}`} value={m}>
                  {m} ({n})
                </option>
              ))}
            </optgroup>
          )}
          {term && !conditions.some(([c]) => c === term) && !medicines.some(([m]) => m === term) && <option value={term}>{term}</option>}
        </select>
      </label>

      <label className="grid gap-1 text-xs text-stone-600">
        Minimum score
        <select id="filter-min" className={sel} value={minScore ?? ""} onChange={(e) => set("min", e.target.value)}>
          <option value="">Any score</option>
          {minScoreOptions.map((n) => (
            <option key={n} value={n}>
              {n} and above
            </option>
          ))}
        </select>
      </label>

      {active && (
        <button type="button" onClick={clear} className="rounded-md px-3 py-1.5 text-sm text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline">
          Clear filters
        </button>
      )}
    </div>
  );
}

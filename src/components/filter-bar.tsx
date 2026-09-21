"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Apple, Frown, Gauge, HeartPulse, Layers, MessageCircleQuestion, Pill, SlidersHorizontal, Smartphone, X } from "lucide-react";
import { cx, INTENT_LABEL } from "@/lib/format";
import type { Intent } from "@/lib/types";
import { Dropdown, type DropdownGroup } from "./dropdown";

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

const ic = "size-4";
const GROUP_ICON: Record<string, React.ReactNode> = {
  medicine_food_question: <Pill className={ic} aria-hidden />,
  app_recommendation: <Smartphone className={ic} aria-hidden />,
  competitor_complaint: <Frown className={ic} aria-hidden />,
  nutrition_question: <Apple className={ic} aria-hidden />,
};

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

  const groupOptions: DropdownGroup[] = [
    { options: GROUPS.map((g) => ({ value: g, label: INTENT_LABEL[g], count: intents[g] ?? 0, icon: GROUP_ICON[g] })) },
  ];

  const termGroups: DropdownGroup[] = [
    {
      label: "Conditions",
      icon: <HeartPulse className="size-3" aria-hidden />,
      options: conditions.map(([c, n]) => ({ value: c, label: c, count: n, icon: <HeartPulse className={ic} aria-hidden /> })),
    },
    {
      label: "Medicines",
      icon: <Pill className="size-3" aria-hidden />,
      options: medicines.map(([m, n]) => ({ value: m, label: m, count: n, icon: <Pill className={ic} aria-hidden /> })),
    },
  ];
  // A term from the URL that is no longer in either list still shows as chosen.
  if (term && !conditions.some(([c]) => c === term) && !medicines.some(([m]) => m === term)) {
    termGroups.push({ label: "Chosen", options: [{ value: term, label: term, icon: <HeartPulse className={ic} aria-hidden /> }] });
  }

  const scoreGroups: DropdownGroup[] = [
    { options: minScoreOptions.map((n) => ({ value: String(n), label: `${n} and above`, icon: <Gauge className={ic} aria-hidden /> })) },
  ];

  const labelIcon = "size-3.5";

  return (
    <div className={cx("rounded-2xl bg-stone-100/70 p-4 ring-1 ring-stone-200/70 transition-opacity", pending && "opacity-70")} aria-busy={pending}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-stone-800">
          <SlidersHorizontal className="size-4 text-emerald-700" aria-hidden />
          Filters
        </span>
        {active && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-600 transition hover:bg-white hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            <X className="size-3.5" aria-hidden />
            Clear filters
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Dropdown
          id="filter-group"
          label="Group"
          labelIcon={<MessageCircleQuestion className={labelIcon} aria-hidden />}
          value={intent ?? ""}
          anyOption={{ value: "", label: "All groups", icon: <Layers className={ic} aria-hidden /> }}
          groups={groupOptions}
          onChange={(v) => set("group", v)}
        />
        <Dropdown
          id="filter-term"
          label="Condition or medicine"
          labelIcon={<HeartPulse className={labelIcon} aria-hidden />}
          value={term ?? ""}
          anyOption={{ value: "", label: "Any", icon: <Layers className={ic} aria-hidden /> }}
          groups={termGroups}
          searchable
          searchPlaceholder="Search…"
          onChange={(v) => set("term", v)}
        />
        <Dropdown
          id="filter-min"
          label="Minimum score"
          labelIcon={<Gauge className={labelIcon} aria-hidden />}
          value={minScore ? String(minScore) : ""}
          anyOption={{ value: "", label: "Any score", icon: <Layers className={ic} aria-hidden /> }}
          groups={scoreGroups}
          onChange={(v) => set("min", v)}
        />
      </div>
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { cx } from "@/lib/format";

export function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" | "muted" }) {
  const cls =
    tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-700" : tone === "muted" ? "text-stone-400" : "text-stone-900";
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200">
      <div className={cx("text-xl font-semibold leading-tight tabular-nums", cls)}>{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

/** Page title block: an icon tile, the title, an optional count, a line of text, and anything on the right. */
export function PageHeader({
  icon,
  title,
  count,
  children,
  aside,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start gap-4">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-stone-200">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
          {typeof count === "number" && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-emerald-800">{count.toLocaleString()}</span>
          )}
          {aside && <div className="sm:ml-auto">{aside}</div>}
        </div>
        {children && <div className="mt-1 max-w-3xl text-sm leading-relaxed text-stone-600">{children}</div>}
      </div>
    </header>
  );
}

/** A section heading with an optional step number or icon, and a short line under it. */
export function Section({
  title,
  step,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  step?: number;
  icon?: LucideIcon;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2.5">
        {typeof step === "number" ? (
          <span className="grid size-7 place-items-center rounded-lg bg-emerald-700 text-xs font-semibold text-white">{step}</span>
        ) : Icon ? (
          <span className="grid size-7 place-items-center rounded-lg bg-emerald-100 text-emerald-800">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        {typeof step === "number" && Icon && <Icon className="size-4 text-stone-400" aria-hidden />}
      </div>
      {description && <p className="-mt-1 mb-3 max-w-2xl text-sm text-stone-600">{description}</p>}
      {children}
    </section>
  );
}

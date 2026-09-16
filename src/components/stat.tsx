import { cx } from "@/lib/format";

export function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" | "muted" }) {
  const cls =
    tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-700" : tone === "muted" ? "text-stone-400" : "text-stone-900";
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
      <div className={cx("text-xl font-semibold leading-tight", cls)}>{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}

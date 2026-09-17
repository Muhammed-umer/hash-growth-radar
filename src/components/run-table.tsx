import { fmtDateTime, fmtDuration } from "@/lib/format";
import type { RunRow } from "@/lib/types";

const tone: Record<RunRow["status"], string> = {
  ok: "bg-emerald-100 text-emerald-900",
  error: "bg-red-100 text-red-900",
  skipped: "bg-amber-100 text-amber-900",
  running: "bg-sky-100 text-sky-900",
};

export function RunTable({ runs }: { runs: RunRow[] }) {
  if (runs.length === 0) return <p className="text-sm text-stone-500">No runs yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-xs">
        <thead className="bg-stone-50 text-left uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-3 py-2">Started (IST)</th>
            <th className="px-3 py-2">Job</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Fetched</th>
            <th className="px-3 py-2 text-right">New</th>
            <th className="px-3 py-2 text-right">Dupes</th>
            <th className="px-3 py-2 text-right">Filtered</th>
            <th className="px-3 py-2 text-right">Queued</th>
            <th className="px-3 py-2 text-right">Tagged</th>
            <th className="px-3 py-2">Took</th>
            <th className="px-3 py-2">Notes / error</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-stone-100 align-top">
              <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(r.started_at)}</td>
              <td className="px-3 py-2">{r.job}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 ${tone[r.status]}`}>{r.status}</span>
              </td>
              <td className="px-3 py-2 text-right">{r.fetched}</td>
              <td className="px-3 py-2 text-right">{r.stored}</td>
              <td className="px-3 py-2 text-right">{r.duplicates}</td>
              <td className="px-3 py-2 text-right">{r.filtered_out}</td>
              <td className="px-3 py-2 text-right">{r.queued}</td>
              <td className="px-3 py-2 text-right">{r.tagged}</td>
              <td className="whitespace-nowrap px-3 py-2">{fmtDuration(r.started_at, r.finished_at)}</td>
              <td className="max-w-md px-3 py-2 text-stone-600">
                {r.error ? <span className="text-red-800">{r.error}</span> : r.notes ? JSON.stringify(r.notes) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

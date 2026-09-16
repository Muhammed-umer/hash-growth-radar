import { aiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { envPresence } from "@/lib/env";
import { jobCounts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/settings-form";
import { Section, Stat } from "@/components/stat";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireUser();
  const [settings, jobs] = await Promise.all([getSettings(), jobCounts()]);
  const ai = aiConfigured();
  const keys = envPresence();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-stone-600">What the tool watches and how it filters.</p>

      <Section title="Health">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label={`AI provider: ${ai.provider}${ai.keys && ai.keys > 1 ? ` (${ai.keys} keys rotated)` : ""}`}
            value={ai.ok ? "ready" : "not set"}
            tone={ai.ok ? "good" : "bad"}
          />
          <Stat label="AI jobs waiting" value={jobs.pending} tone={jobs.pending ? "warn" : "muted"} />
          <Stat label="AI jobs failed" value={jobs.failed} tone={jobs.failed ? "bad" : "muted"} />
          <Stat label="AI jobs done" value={jobs.done} tone="muted" />
        </div>
        {!ai.ok && <p className="mt-2 text-sm text-red-800">{ai.reason}. Tagging cannot run until this is set.</p>}
        <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-stone-50 text-left uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2">Environment variable</th>
                <th className="px-3 py-2">Purpose</th>
                <th className="px-3 py-2">Present</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.key} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-mono">{k.key}</td>
                  <td className="px-3 py-2 text-stone-600">{k.purpose}</td>
                  <td className="px-3 py-2">
                    {k.present ? (
                      <span className="text-emerald-700">✓ set{k.note ? ` (${k.note})` : ""}</span>
                    ) : (
                      <span className={k.required ? "text-red-700" : "text-stone-400"}>{k.required ? "✗ required" : "– optional"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-500">Values are never shown here. Set them in .env.local (local) or Vercel → Project → Settings → Environment Variables.</p>
      </Section>

      <Section title="Watch lists and keyword filter">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <SettingsForm settings={settings} />
        </div>
      </Section>
    </div>
  );
}

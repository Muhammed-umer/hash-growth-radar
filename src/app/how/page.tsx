import { aiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { CONFIG, RETENTION_DAYS, RUNS_PER_DAY, TOP_N } from "@/lib/config";
import { envPresence } from "@/lib/env";
import { INTENT_LABEL } from "@/lib/format";
import { Section } from "@/components/stat";

export const dynamic = "force-dynamic";

/**
 * A plain read-only explanation of what the tool does. It reads the real
 * config so the topics shown are the topics used. Nothing here can be edited;
 * to change a topic, edit src/lib/config.ts and deploy.
 */
export default async function HowPage() {
  await requireUser();
  const ai = aiConfigured();
  const keys = envPresence().filter((k) => k.required || k.present);
  const perRun = Math.min(CONFIG.youtube_max_searches_per_run, CONFIG.youtube_topics.length);

  return (
    <div>
      <h1 className="text-2xl font-semibold">How it works</h1>
      <p className="text-sm text-stone-600">What the tool looks for, how it gets it, and how it sorts it. Nothing on this page can be changed here.</p>

      <Section title="1 · The topics">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <p className="text-stone-700">
            These {CONFIG.youtube_topics.length} phrases are typed into YouTube search. The videos they find are where we read comments. The first six find people asking about food with a medicine or condition; the last three find people choosing or complaining about a calorie app.
          </p>
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {CONFIG.youtube_topics.map((t, i) => (
              <li key={t} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-700 text-xs font-semibold text-white">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section title="2 · How we get the comments">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-stone-700">
            <li>
              <b>Every 2 hours</b> a timer inside the database wakes the app. No one presses anything.
            </li>
            <li>
              <b>{perRun} topics are searched</b> on YouTube, the next {perRun} in the list each time, so all {CONFIG.youtube_topics.length} come up 5 or 6 times a day. Only videos from the last 90 days, best match first, {CONFIG.youtube_videos_per_topic} videos per topic.
            </li>
            <li>
              <b>The newest {CONFIG.youtube_comments_per_video} comments</b> under each video are read. Only the text, the time, and the like count. The commenter&apos;s name is never read or stored.
            </li>
            <li>
              <b>Repeats are thrown away.</b> Most runs return the same popular videos; every comment has a permanent id, and one we already have is ignored. Only comments posted since the last look are new.
            </li>
            <li>
              <b>A keyword check</b> keeps comments that mention a medicine, a condition, or a calorie app, look like a question, and contain no spam words. About 4 in 5 are dropped here, before any AI runs.
            </li>
            <li>
              <b>Everything is deleted after {RETENTION_DAYS} days.</b>
            </li>
          </ol>
          <p className="mt-3 text-xs text-stone-500">
            This uses Google&apos;s free YouTube allowance: {perRun * RUNS_PER_DAY} of 100 daily searches and about {perRun * CONFIG.youtube_videos_per_topic * RUNS_PER_DAY} of 10,000 daily units. Full detail in docs/youtube.html.
          </p>
        </div>
      </Section>

      <Section title="3 · How we classify">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <p className="text-stone-700">
            The AI (Google Gemini, free tier) reads each remaining comment once and fills in a fixed form: what is being asked, which medicine and condition are named, which competitor app if any, how well Hash fits it (0 to 100), urgency, language, and a one-line summary. It never describes the person. It sorts the question into one of five groups:
          </p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="py-1 pr-3">Group</th>
                <th className="py-1 pr-3">Example</th>
                <th className="py-1">What happens</th>
              </tr>
            </thead>
            <tbody className="text-stone-700">
              <Row g="medicine_food_question" ex="Can I keep eating rice on metformin?" what="On the list, top priority" />
              <Row g="app_recommendation" ex="Which app understands Indian food?" what="On the list" />
              <Row g="competitor_complaint" ex="Cal AI keeps calling my dal pasta" what="On the list" />
              <Row g="nutrition_question" ex="Is oats good for weight loss?" what="On the list only when the fit is high" />
              <Row g="irrelevant" ex="Great video sir" what="Dropped" />
            </tbody>
          </table>
          <p className="mt-3 text-stone-700">
            Anyone asking for a dosage or a diagnosis, describing an emergency, or talking about eating disorders or mental health is marked <b>not suitable</b> and never shown. Everything else gets a score (fit, plus a bonus for the group, minus a little per day of age) and the top {TOP_N} appear on Today.
          </p>
        </div>
      </Section>

      <Section title="System check">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <p className="text-stone-700">
            AI provider: <b>{ai.provider}</b>, {ai.ok ? <span className="text-emerald-700">ready{ai.keys && ai.keys > 1 ? ` (${ai.keys} keys rotated)` : ""}</span> : <span className="text-red-700">not set: {ai.reason}</span>}
          </p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {keys.map((k) => (
              <li key={k.key} className="flex items-center gap-2">
                <span className={k.present ? "text-emerald-700" : "text-red-700"}>{k.present ? "✓" : "✗"}</span>
                <code className="text-xs">{k.key}</code>
                <span className="text-xs text-stone-500">{k.note ?? k.purpose}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-500">Values are never shown. They live in the host&apos;s environment variables.</p>
        </div>
      </Section>
    </div>
  );
}

function Row({ g, ex, what }: { g: string; ex: string; what: string }) {
  return (
    <tr className="border-t border-stone-100">
      <td className="py-1.5 pr-3 font-medium">{INTENT_LABEL[g] ?? g}</td>
      <td className="py-1.5 pr-3 italic text-stone-600">&ldquo;{ex}&rdquo;</td>
      <td className="py-1.5">{what}</td>
    </tr>
  );
}

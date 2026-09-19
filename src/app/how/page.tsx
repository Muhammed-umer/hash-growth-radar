import { aiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { CONFIG, RETENTION_DAYS, TOP_N, YT } from "@/lib/config";
import { envPresence } from "@/lib/env";
import { INTENT_LABEL } from "@/lib/format";
import { Section } from "@/components/stat";

export const dynamic = "force-dynamic";

const CRON_JOBS: { name: string; when: string; runs: "regular" | "one time"; what: string }[] = [
  {
    name: "radar_collect",
    when: "every 2 hours, on the hour (UTC)",
    runs: "regular",
    what: "Checks which watched videos got new comments, reads those comments up to the last one already seen, runs the keyword check, and sends the passing comments to Gemini.",
  },
  {
    name: "radar_sweep",
    when: "every 2 hours at :10 (UTC)",
    runs: "one time",
    what: "Use case 2. Searches each topic one month at a time backwards to January 2026. Saves its place after every page, stops for the day at the search cap, and switches itself off when every month is done.",
  },
  {
    name: "radar_discover",
    when: "every 6 hours at :20 (UTC)",
    runs: "regular",
    what: "Use case 1. Searches each topic for videos uploaded since the last look; once a day also runs one plain relevance search per topic for an older video that just became popular.",
  },
  {
    name: "radar_channels",
    when: "daily 08:30 UTC (14:00 IST)",
    runs: "regular",
    what: "Reads the newest uploads of every followed channel. For a channel followed for the first time it also walks the channel's upload history once (that part is one time per channel).",
  },
  {
    name: "radar_process",
    when: "every hour at :30 (UTC)",
    runs: "regular",
    what: "Sends to Gemini any comment still waiting for tagging, and recalculates the freshness penalty on every score.",
  },
  {
    name: "radar_cleanup",
    when: "daily 03:00 UTC (08:30 IST)",
    runs: "regular",
    what: `Deletes comments ${RETENTION_DAYS} days after YouTube last returned them, and stops following channels that have gone quiet.`,
  },
  {
    name: "radar_coverage",
    when: "Mondays 09:00 UTC (14:30 IST)",
    runs: "regular",
    what: "Compares 20 followed channels' real upload lists with the watch list and adds anything that was missed.",
  },
];

/**
 * A plain read-only explanation of what the tool does. It reads the real
 * config so the topics shown are the topics used. Nothing here can be edited;
 * to change a topic, edit src/lib/config.ts and deploy.
 */
export default async function HowPage() {
  await requireUser();
  const ai = aiConfigured();
  const keys = envPresence().filter((k) => k.required || k.present);
  const floor = new Date(YT.sweep_floor).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div>
      <h1 className="text-2xl font-semibold">How it works</h1>
      <p className="text-sm text-stone-600">What the tool looks for, how it gets it, and how it sorts it. Nothing on this page can be changed here.</p>

      <Section title="1 · The topics we chose">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <p className="text-stone-700">
            These {CONFIG.youtube_topics.length} phrases are what the tool types into YouTube search. Five name a health condition (diabetes, PCOS, thyroid); &ldquo;Indian weight loss diet&rdquo; is there for questions about Indian food.
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

      <Section title="2 · The two use cases">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <div className="text-xs font-semibold uppercase text-emerald-800">Use case 1 · Collect every video under the topics, as it appears</div>
            <p className="mt-2 text-stone-700">
              Going forward. Every 6 hours each topic is searched for videos uploaded since the last look, so a new video is on the watch list within hours. Once a day one plain relevance search per topic catches an older video that just became popular. Every channel that made an on-topic video is followed, and its newest uploads are read daily, which finds videos that search never shows.
            </p>
            <p className="mt-2 text-xs text-stone-500">Runs for as long as the tool is on.</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <div className="text-xs font-semibold uppercase text-emerald-800">Use case 2 · Cover the older videos, backwards to {floor}</div>
            <p className="mt-2 text-stone-700">
              Going backward. YouTube search shows at most about 500 results per query and ranks them by relevance, so one search cannot list everything. Instead each topic is searched one month at a time, newest month first, back to {floor}, in two orders (most viewed and newest), up to 10 pages of 50. A month that looks cut off is split in half and swept again. The position is saved after every page, so it carries on across days.
            </p>
            <p className="mt-2 text-xs text-stone-500">Runs once. It stops for the day at {YT.sweep_search_cap} searches and switches itself off when every month is done.</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          Every YouTube call is counted in a ledger before it is made. The jobs stop at {YT.ledger_caps.searches} of the 100 daily searches and {YT.ledger_caps.units.toLocaleString()} of the 10,000 daily units; comment reading stops at {YT.reader_unit_cap.toLocaleString()} units so the channel check always has room. Full detail in docs/coverage-plan.html.
        </p>
      </Section>

      <Section title="3 · The cron jobs">
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Regular or one time</th>
                <th className="px-3 py-2">What it does</th>
              </tr>
            </thead>
            <tbody className="text-stone-700">
              {CRON_JOBS.map((j) => (
                <tr key={j.name} className="border-t border-stone-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{j.name}</td>
                  <td className="whitespace-nowrap px-3 py-2">{j.when}</td>
                  <td className="px-3 py-2">
                    <span className={j.runs === "regular" ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900" : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"}>{j.runs}</span>
                  </td>
                  <td className="px-3 py-2">{j.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          A timer inside the Supabase database (pg_cron) calls the app on this schedule. No one presses anything. All seven are registered by supabase/migrations/0002_cron.sql.
        </p>
      </Section>

      <Section title="4 · How we get the comments">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-stone-700">
            <li>
              <b>Ask which videos changed.</b> Every 2 hours the comment counts of the watched videos that are due are refreshed, 50 videos per unit: new or busy videos every 2 hours, quiet ones daily or weekly. A video&apos;s comments are read only when its count moved, it is under {YT.fresh_days} days old, or it has not been read for {YT.reread_days} days.
            </li>
            <li>
              <b>Read to the last comment already seen.</b> Comments come newest first, 100 a page, first replies included, and reading stops at the newest comment stored last time. For each comment we keep the text, the time, the like count and the video it is under. The commenter&apos;s name is never stored; the video creator&apos;s own comments are dropped.
            </li>
            <li>
              <b>Stored comments are deleted {RETENTION_DAYS} days after YouTube last returned them</b> (YouTube&apos;s own rule for stored data).
            </li>
          </ol>
        </div>
      </Section>

      <Section title="5 · How we drop a comment">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <p className="text-stone-700">A comment is dropped at one of two gates. The first costs nothing; only what passes it reaches Gemini.</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-stone-700">
            <li>
              <b>The keyword check (no AI).</b> Dropped if it is shorter than 15 characters; posted before {new Date(YT.comment_floor).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}; contains a spam word (giveaway, promo code, crypto, casino, hiring&hellip;); mentions no medicine, condition, calorie app or diet phrase (&ldquo;what to eat&rdquo;, &ldquo;roti&rdquo;, &ldquo;rice&rdquo;&hellip;); or does not look like a question. The reason is shown as <i>too_short</i>, <i>too_old</i>, <i>blocked:&hellip;</i>, <i>no_keyword</i> or <i>not_a_question</i> under &ldquo;Recently dropped&rdquo;.
            </li>
            <li>
              <b>Gemini&apos;s judgement.</b> Dropped as <i>ai:irrelevant</i> when the group is &ldquo;irrelevant&rdquo; (praise, chit-chat, off topic). Marked <b>not suitable</b> when the person asks for a dosage or a diagnosis, describes an emergency, or talks about eating disorders, self-harm or mental health. Both never appear on Today; the YouTube page shows their text, without a link, under &ldquo;Recently dropped&rdquo;.
            </li>
          </ol>
          <p className="mt-3 text-stone-700">
            <b>A rule check after Gemini.</b> If Gemini says &ldquo;asking for an app&rdquo; or &ldquo;complaint about an app&rdquo; but the comment never mentions an app, tracker or product name (&ldquo;which is better, sugar or jaggery?&rdquo;), the group is corrected to a food question and the score recomputed. Gemini&apos;s original answer is kept alongside for checking.
          </p>
        </div>
      </Section>

      <Section title="6 · What we use Gemini for">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <p className="text-stone-700">
            Gemini (free tier by default; the System check below shows which model is set) is used for exactly one thing: reading a comment that passed the keyword check, once, and filling in a fixed form. It never describes the person, never writes a reply, and is not used to find videos, to run the keyword check, or to compute the score. The form has nine fields:
          </p>
          <ul className="mt-3 grid gap-1.5 text-stone-700 sm:grid-cols-2">
            <li className="rounded-lg bg-stone-50 px-3 py-2"><b>Group</b> — one of the five below.</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2"><b>Conditions</b> named in the text (e.g. type 2 diabetes).</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2"><b>Medicines</b> named in the text (e.g. metformin).</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2"><b>Competitor app</b> named, if any (Cal AI, HealthifyMe&hellip;).</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2"><b>Fit</b>, 0 to 100 — how well Hash answers this exact question.</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2"><b>Urgency</b> — low, medium or high.</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2"><b>Language</b> — English, Hinglish or other.</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2"><b>Not suitable</b> flag, with the reason (dosage, diagnosis, emergency, eating disorder, mental health).</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2 sm:col-span-2"><b>Summary</b> — one plain sentence saying what is being asked. No names.</li>
          </ul>
          <table className="mt-4 w-full text-sm">
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
              <Row g="nutrition_question" ex="Is oats good for weight loss?" what="On the list, usually low (fit 20 to 50, no bonus)" />
              <Row g="irrelevant" ex="Great video sir" what="Dropped" />
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="7 · How the score is calculated">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
          <p>
            <b>Fit</b> is not shown on the card, but the score is built from it. It is Gemini&apos;s own judgement, 0 to 100, of how directly a food tracker that understands medicines and conditions answers that exact comment: food with a named medicine or condition 80 to 100, a direct request for a calorie app 70 to 90, a complaint that an app fails on Indian food or ignores medication 60 to 85, a general diet question 20 to 50.
          </p>
          <p className="mt-2">
            <b>Score</b>, the only number on the card, is plain arithmetic on top of fit, done by the app, not by Gemini: fit, plus a bonus for the group (medicine and food 15, asking for an app 10, complaint about an app 5, general nutrition 0), plus 0, 3 or 6 for urgency, minus 2 for every full day since the comment was posted, at most 14 (so the penalty stops growing after 7 days). The penalty is recalculated every hour, so the order stays current. Today shows the top {TOP_N}, by score or by newest comment, whichever you pick.
          </p>
          <p className="mt-2">
            <b>Skip</b> is the only button that changes anything: it hides a card once you have looked at it. It only marks the card as skipped; whether you approached the person is never recorded.
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

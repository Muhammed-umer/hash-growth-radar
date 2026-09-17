import { aiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { CONFIG, RETENTION_DAYS, TOP_N, YT } from "@/lib/config";
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

  return (
    <div>
      <h1 className="text-2xl font-semibold">How it works</h1>
      <p className="text-sm text-stone-600">What the tool looks for, how it gets it, and how it sorts it. Nothing on this page can be changed here.</p>

      <Section title="1 · The topics">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <p className="text-stone-700">
            These {CONFIG.youtube_topics.length} phrases are typed into YouTube search. Every video they find, and every video from the channels behind those videos, goes on a watch list, and comments are read from that list. Five of them name a health condition (diabetes, PCOS, thyroid); &ldquo;Indian weight loss diet&rdquo; finds questions about Indian food.
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

      <Section title="2 · How we find the videos">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <p className="text-stone-700">
            YouTube search is not a catalogue: one query shows at most 50 videos a page and runs dry near 500, ranked by relevance, and gives a different set on different days. So the tool never reads comments from a search result. It builds a <b>watch list</b> of videos through four doors and reads from that.
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-stone-700">
            <li>
              <b>The month sweep (one time).</b> Each phrase is searched one month at a time back to {new Date(YT.sweep_floor).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}, newest month first, in two orders (most viewed and newest), up to 10 pages of 50 each. The page position is saved after every page, so the sweep continues across days. A month that looks cut off at the limit is split in half and each half is swept again. It stops for the day at {YT.sweep_search_cap} searches and switches itself off when every month is done.
            </li>
            <li>
              <b>New videos (every 6 hours).</b> Each phrase is searched &ldquo;newest first, uploaded after the last time we looked&rdquo;, up to {YT.discover_pages_per_topic} pages. Almost every result is new; if there are more, the rest is handed to the month sweep.
            </li>
            <li>
              <b>The relevance net (daily).</b> One plain search per phrase, for the older video that just became popular.
            </li>
            <li>
              <b>Channels (daily).</b> Every channel that made an on-topic video is followed: its upload list is read once, up to {(YT.channel_history_max_pages * 50).toLocaleString()} videos (1 unit per 50 videos, no search), then only its newest page each day. This finds videos search never showed, and new uploads from followed channels arrive within a day.
            </li>
          </ol>
          <p className="mt-3 text-xs text-stone-500">
            Every call is counted in a ledger before it is made. The jobs stop at {YT.ledger_caps.searches} of the 100 daily searches and {YT.ledger_caps.units.toLocaleString()} of the 10,000 daily units; comment reading stops at {YT.reader_unit_cap.toLocaleString()} units so the channel check always has room. Full detail in docs/coverage-plan.html.
          </p>
        </div>
      </Section>

      <Section title="3 · How we get the comments">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-stone-700">
            <li>
              <b>Every 2 hours</b> a timer inside the database wakes the app. No one presses anything.
            </li>
            <li>
              <b>Ask which videos changed.</b> The comment counts of the watched videos that are due are refreshed, 50 videos per unit: new or busy videos every 2 hours, quiet ones daily or weekly. A video&apos;s comments are read only when its count moved, it is under {YT.fresh_days} days old, or it has not been read for {YT.reread_days} days. Shorts are read weekly.
            </li>
            <li>
              <b>Read to the last comment already seen.</b> Comments come newest first, 100 a page, first replies included, and reading stops at the newest comment stored last time. For each comment we keep the text, the time, the like count and the video it is under. The commenter&apos;s name is never stored; the video creator&apos;s own comments are dropped.
            </li>
            <li>
              <b>A keyword check</b> passes comments that mention a medicine, a condition, a calorie app or a diet question (&ldquo;what to eat&rdquo;, &ldquo;roti&rdquo;, &ldquo;rice&rdquo;), look like a question, and contain no spam words. Comments that fail, and comments posted before {new Date(YT.comment_floor).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}, are marked dropped and never sent to the AI.
            </li>
            <li>
              <b>Stored comments are deleted {RETENTION_DAYS} days after YouTube last returned them</b> (YouTube&apos;s own rule for stored data).
            </li>
          </ol>
        </div>
      </Section>

      <Section title="4 · How we classify">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <p className="text-stone-700">
            The AI (Google Gemini on its free tier by default; the System check below shows which one is set) reads each comment that passed the keyword check once and fills in a fixed form: what is being asked, which medicine and condition are named, which competitor app if any, a <b>fit</b> number from 0 to 100 (how well Hash answers it), urgency, language, whether the person is suitable to approach, and a one-line summary. It never describes the person. It sorts the question into one of five groups:
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
              <Row g="nutrition_question" ex="Is oats good for weight loss?" what="On the list, usually low (fit 20 to 50, no bonus)" />
              <Row g="irrelevant" ex="Great video sir" what="Dropped" />
            </tbody>
          </table>
          <p className="mt-3 text-stone-700">
            Anyone asking for a dosage or a diagnosis, describing an emergency, or talking about eating disorders, self-harm or mental health is marked <b>not suitable</b>. They never appear on Today or in the list of people to look at; the YouTube page shows their text, without a link, under &ldquo;Recently dropped&rdquo;.
          </p>
        </div>
      </Section>

      <Section title="5 · The score on each card">
        <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
          <p>
            <b>Fit</b> is not shown on the card, but the score is built from it. It is the AI&apos;s own judgement, 0 to 100, of how directly a food tracker that understands medicines and conditions answers that exact comment: food with a named medicine or condition 80 to 100, a direct request for a calorie app 70 to 90, a complaint that an app fails on Indian food or ignores medication 60 to 85, a general diet question 20 to 50.
          </p>
          <p className="mt-2">
            <b>Score</b>, the only number on the card, is plain arithmetic on top of fit: fit, plus a bonus for the group (medicine and food 15, asking for an app 10, competitor complaint 5, general nutrition 0), plus 0, 3 or 6 for urgency, minus 2 for every full day since the comment was posted, at most 14 (so the penalty stops growing after 7 days). The penalty is recalculated every hour, so the order stays current. Today shows the top {TOP_N}, by score or by newest comment, whichever you pick.
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

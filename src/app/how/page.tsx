import { aiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { CONFIG, RETENTION_DAYS, TOP_N, YT } from "@/lib/config";
import { envPresence } from "@/lib/env";
import { INTENT_LABEL } from "@/lib/format";
import { Section } from "@/components/stat";

export const dynamic = "force-dynamic";

const CRON_JOBS: { name: string; when: string; runs: "regular" | "one time"; what: string }[] = [
  { name: "radar_collect", when: "every 2 hours, on the hour (UTC)", runs: "regular", what: "Finds watched videos with new comments, reads the new comments, runs the keyword check, sends the survivors to Gemini." },
  { name: "radar_sweep", when: "every 2 hours at :10 (UTC)", runs: "one time", what: "Use case 2. Searches each topic one month at a time, backwards to January 2026. Switches itself off when every month is done." },
  { name: "radar_discover", when: "every 6 hours at :20 (UTC)", runs: "regular", what: "Use case 1. Searches each topic for videos uploaded since the last look. Once a day, one relevance search per topic." },
  { name: "radar_channels", when: "daily 08:30 UTC (14:00 IST)", runs: "regular", what: "Reads the newest uploads of every followed channel. A newly followed channel also gets its history read once." },
  { name: "radar_process", when: "every hour at :30 (UTC)", runs: "regular", what: "Sends any comment still waiting to Gemini. Recalculates the age penalty on every score." },
  { name: "radar_cleanup", when: "daily 03:00 UTC (08:30 IST)", runs: "regular", what: `Deletes comments ${RETENTION_DAYS} days after YouTube last returned them. Stops following quiet channels.` },
  { name: "radar_coverage", when: "Mondays 09:00 UTC (14:30 IST)", runs: "regular", what: "Compares 20 followed channels' real upload lists with the watch list. Adds anything missed." },
];

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500";
const td = "px-3 py-2 align-top";
const box = "rounded-xl border border-stone-200 bg-white p-4 text-sm";
const tableWrap = "overflow-x-auto rounded-xl border border-stone-200 bg-white";

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
  const commentFloor = new Date(YT.comment_floor).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <h1 className="text-2xl font-semibold">How it works</h1>
      <p className="text-sm text-stone-600">What the tool looks for, how it gets it, how it sorts it. Read-only; nothing here can be changed.</p>

      {/* 1 */}
      <Section title="1 · The topics we chose">
        <div className={box}>
          <p className="text-stone-700">These {CONFIG.youtube_topics.length} phrases are what the tool types into YouTube search.</p>
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {CONFIG.youtube_topics.map((t, i) => (
              <li key={t} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-700 text-xs font-semibold text-white">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-stone-500">Five name a health condition (diabetes, PCOS, thyroid). &ldquo;Indian weight loss diet&rdquo; is there for questions about Indian food.</p>
        </div>
      </Section>

      {/* 2 */}
      <Section title="2 · The two use cases">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={box}>
            <div className="text-xs font-semibold uppercase text-emerald-800">Use case 1 · New videos, going forward</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
              <li>Every 6 hours: each topic is searched for videos uploaded since the last look.</li>
              <li>Once a day: one plain relevance search per topic, for an older video that just became popular.</li>
              <li>Every channel that made an on-topic video is followed; its newest uploads are read daily.</li>
            </ul>
            <p className="mt-2 text-xs text-stone-500">Runs for as long as the tool is on.</p>
          </div>
          <div className={box}>
            <div className="text-xs font-semibold uppercase text-emerald-800">Use case 2 · Older videos, backwards to {floor}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
              <li>One search cannot list everything: YouTube shows at most about 500 results per query.</li>
              <li>So each topic is searched one month at a time, newest month first, back to {floor}.</li>
              <li>Two orders per month (most viewed, newest), up to 10 pages of 50. A month that looks cut off is split in half and swept again.</li>
              <li>Position is saved after every page, so it carries on across days.</li>
            </ul>
            <p className="mt-2 text-xs text-stone-500">Runs once. Stops for the day at {YT.sweep_search_cap} searches; switches itself off when every month is done.</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          Every YouTube call is counted before it is made. Jobs stop at {YT.ledger_caps.searches} of the 100 daily searches and {YT.ledger_caps.units.toLocaleString()} of the 10,000 daily units. Comment reading stops at {YT.reader_unit_cap.toLocaleString()} units so the channel check always has room.
        </p>
      </Section>

      {/* 3 */}
      <Section title="3 · The cron jobs">
        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Job</th>
                <th className={th}>When</th>
                <th className={th}>Regular or one time</th>
                <th className={th}>What it does</th>
              </tr>
            </thead>
            <tbody className="text-stone-700">
              {CRON_JOBS.map((j) => (
                <tr key={j.name} className="border-t border-stone-100">
                  <td className={`${td} whitespace-nowrap font-mono text-xs`}>{j.name}</td>
                  <td className={`${td} whitespace-nowrap`}>{j.when}</td>
                  <td className={td}>
                    <span className={j.runs === "regular" ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900" : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"}>{j.runs}</span>
                  </td>
                  <td className={td}>{j.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-500">A timer inside the Supabase database (pg_cron) calls the app on this schedule. No one presses anything. Registered by supabase/migrations/0002_cron.sql.</p>
      </Section>

      {/* 4 */}
      <Section title="4 · How we get the comments">
        <div className={box}>
          <ol className="list-decimal space-y-2 pl-5 text-stone-700">
            <li>
              <b>Which videos changed?</b> Every 2 hours, the comment counts of the watched videos that are due are refreshed (50 videos per unit). New or busy videos are checked every 2 hours, quiet ones daily or weekly.
            </li>
            <li>
              <b>Read only what is new.</b> A video is read when its count moved, it is under {YT.fresh_days} days old, or it has not been read for {YT.reread_days} days. Comments come newest first, 100 a page; reading stops at the newest comment already stored.
            </li>
            <li>
              <b>What is kept.</b> The text, the time, the like count, the video. The commenter&apos;s name is never stored. The video creator&apos;s own comments are dropped.
            </li>
            <li>
              <b>How long.</b> Deleted {RETENTION_DAYS} days after YouTube last returned the comment (YouTube&apos;s rule for stored data).
            </li>
          </ol>
        </div>
      </Section>

      {/* 5 */}
      <Section title="5 · How we drop a comment">
        <p className="mb-3 text-sm text-stone-600">Two gates. The first costs nothing; only what passes it reaches Gemini.</p>
        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Gate</th>
                <th className={th}>Dropped when</th>
                <th className={th}>Reason shown under &ldquo;Recently dropped&rdquo;</th>
              </tr>
            </thead>
            <tbody className="text-stone-700">
              <tr className="border-t border-stone-100"><td className={`${td} font-semibold`} rowSpan={5}>1 · Keyword check<br /><span className="text-xs font-normal text-stone-500">no AI</span></td><td className={td}>Shorter than 15 characters</td><td className={`${td} font-mono text-xs`}>too_short</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Posted before {commentFloor}</td><td className={`${td} font-mono text-xs`}>too_old</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Contains a spam word (giveaway, promo code, crypto, casino, hiring&hellip;)</td><td className={`${td} font-mono text-xs`}>blocked:&lt;word&gt;</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Mentions no medicine, condition, calorie app or diet phrase (&ldquo;what to eat&rdquo;, &ldquo;roti&rdquo;, &ldquo;rice&rdquo;&hellip;)</td><td className={`${td} font-mono text-xs`}>no_keyword</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Does not look like a question</td><td className={`${td} font-mono text-xs`}>not_a_question</td></tr>
              <tr className="border-t border-stone-200"><td className={`${td} font-semibold`} rowSpan={2}>2 · Gemini&apos;s judgement</td><td className={td}>Group is &ldquo;irrelevant&rdquo; (praise, chit-chat, off topic)</td><td className={`${td} font-mono text-xs`}>ai:irrelevant</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Asks for a dosage or a diagnosis, describes an emergency, or concerns eating disorders, self-harm, mental health, pregnancy or a child</td><td className={td}><b>Not suitable</b></td></tr>
            </tbody>
          </table>
        </div>
        <div className={`${box} mt-3`}>
          <p className="text-stone-700">
            <b>A rule check after Gemini.</b> If Gemini says &ldquo;asking for an app&rdquo; or &ldquo;complaint about an app&rdquo; but the comment never mentions an app, tracker or product name (for example &ldquo;which is better, sugar or jaggery?&rdquo;), the group is corrected to a food question and the score is recomputed. Gemini&apos;s original answer is kept alongside.
          </p>
          <p className="mt-2 text-xs text-stone-500">Dropped and not-suitable comments never appear on Today. The YouTube page shows their text, without a link, under &ldquo;Recently dropped&rdquo;.</p>
        </div>
      </Section>

      {/* 6 */}
      <Section title="6 · What we use Gemini for">
        <div className={box}>
          <p className="text-stone-700">
            One job only: read a comment that passed the keyword check, once, and fill in this form. Gemini does not find videos, does not run the keyword check, does not compute the score, and never writes a reply.
          </p>
          <div className={`${tableWrap} mt-3`}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Field</th>
                  <th className={th}>What Gemini fills in</th>
                </tr>
              </thead>
              <tbody className="text-stone-700">
                <tr className="border-t border-stone-100"><td className={`${td} font-semibold`}>Group</td><td className={td}>One of the five groups below</td></tr>
                <tr className="border-t border-stone-100"><td className={`${td} font-semibold`}>Conditions</td><td className={td}>Named in the text, e.g. type 2 diabetes, pcos. Never guessed from the video</td></tr>
                <tr className="border-t border-stone-100"><td className={`${td} font-semibold`}>Medicines</td><td className={td}>Named in the text, e.g. metformin, levothyroxine</td></tr>
                <tr className="border-t border-stone-100"><td className={`${td} font-semibold`}>Competitor app</td><td className={td}>Named app, if any (Cal AI, HealthifyMe&hellip;)</td></tr>
                <tr className="border-t border-stone-100"><td className={`${td} font-semibold`}>Fit</td><td className={td}>0 to 100: how directly Hash answers this exact question (bands in section 7)</td></tr>
                <tr className="border-t border-stone-100"><td className={`${td} font-semibold`}>Urgency</td><td className={td}>low, medium or high</td></tr>
                <tr className="border-t border-stone-100"><td className={`${td} font-semibold`}>Language</td><td className={td}>English, Hinglish or other</td></tr>
                <tr className="border-t border-stone-100"><td className={`${td} font-semibold`}>Not suitable</td><td className={td}>Yes/no, with the reason (dosage, diagnosis, emergency, eating disorder, mental health, pregnancy, minor)</td></tr>
                <tr className="border-t border-stone-100"><td className={`${td} font-semibold`}>Summary</td><td className={td}>One plain sentence saying what is asked. No names</td></tr>
              </tbody>
            </table>
          </div>
          <div className={`${tableWrap} mt-3`}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Group</th>
                  <th className={th}>Example</th>
                  <th className={th}>What happens</th>
                </tr>
              </thead>
              <tbody className="text-stone-700">
                <Row g="medicine_food_question" ex="Can I keep eating rice on metformin?" what="On the list, top priority" />
                <Row g="app_recommendation" ex="Which app understands Indian food?" what="On the list" />
                <Row g="competitor_complaint" ex="Cal AI keeps calling my dal pasta" what="On the list" />
                <Row g="nutrition_question" ex="Is oats good for weight loss?" what="On the list, usually lower" />
                <Row g="irrelevant" ex="Great video sir" what="Dropped" />
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* 7 */}
      <Section title="7 · How the score is calculated">
        <p className="mb-3 text-sm text-stone-600">
          Score is the only number on the card. It is plain arithmetic done by the app, not by Gemini. Gemini supplies two inputs: <b>fit</b> and <b>group</b>.
        </p>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className={tableWrap}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th} colSpan={2}>Step 1 · Fit (from Gemini, 0 to 100)</th>
                </tr>
              </thead>
              <tbody className="text-stone-700">
                <tr className="border-t border-stone-100"><td className={td}>Food question naming a medicine, or a condition plus a specific food</td><td className={`${td} whitespace-nowrap font-semibold`}>85 – 100</td></tr>
                <tr className="border-t border-stone-100"><td className={td}>Vague food question naming a condition, or app request for Indian food or a condition</td><td className={`${td} whitespace-nowrap font-semibold`}>70 – 84</td></tr>
                <tr className="border-t border-stone-100"><td className={td}>Generic app request, or complaint about a named app</td><td className={`${td} whitespace-nowrap font-semibold`}>55 – 69</td></tr>
                <tr className="border-t border-stone-100"><td className={td}>General nutrition question, no medicine or condition</td><td className={`${td} whitespace-nowrap font-semibold`}>20 – 50</td></tr>
                <tr className="border-t border-stone-100"><td className={td}>Irrelevant</td><td className={`${td} whitespace-nowrap font-semibold`}>0 – 10</td></tr>
              </tbody>
            </table>
          </div>

          <div className={tableWrap}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th} colSpan={2}>Step 2 · Add a bonus for the group</th>
                </tr>
              </thead>
              <tbody className="text-stone-700">
                <tr className="border-t border-stone-100"><td className={td}>Medicine + food question</td><td className={`${td} whitespace-nowrap font-semibold`}>+ 15</td></tr>
                <tr className="border-t border-stone-100"><td className={td}>Asking for an app</td><td className={`${td} whitespace-nowrap font-semibold`}>+ 10</td></tr>
                <tr className="border-t border-stone-100"><td className={td}>Complaint about an app</td><td className={`${td} whitespace-nowrap font-semibold`}>+ 5</td></tr>
                <tr className="border-t border-stone-100"><td className={td}>Nutrition question</td><td className={`${td} whitespace-nowrap font-semibold`}>+ 0</td></tr>
              </tbody>
              <thead>
                <tr>
                  <th className={`${th} border-t border-stone-200`} colSpan={2}>Step 3 · Add a bonus for urgency</th>
                </tr>
              </thead>
              <tbody className="text-stone-700">
                <tr className="border-t border-stone-100"><td className={td}>low / medium / high</td><td className={`${td} whitespace-nowrap font-semibold`}>+ 0 / + 3 / + 6</td></tr>
              </tbody>
              <thead>
                <tr>
                  <th className={`${th} border-t border-stone-200`} colSpan={2}>Step 4 · Subtract for age</th>
                </tr>
              </thead>
              <tbody className="text-stone-700">
                <tr className="border-t border-stone-100"><td className={td}>Every full day since the comment was posted</td><td className={`${td} whitespace-nowrap font-semibold`}>− 2 per day</td></tr>
                <tr className="border-t border-stone-100"><td className={td}>Maximum penalty (reached after 7 days)</td><td className={`${td} whitespace-nowrap font-semibold`}>− 14</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${box} mt-3`}>
          <div className="text-xs font-semibold uppercase text-emerald-800">Worked example</div>
          <p className="mt-1 text-stone-700">&ldquo;I take metformin, can I eat mango at night?&rdquo; posted 3 days ago.</p>
          <ul className="mt-2 grid gap-1 text-stone-700 sm:grid-cols-2">
            <li>Fit: names a medicine and a food → <b>92</b></li>
            <li>Group: medicine + food → <b>+ 15</b></li>
            <li>Urgency: low → <b>+ 0</b></li>
            <li>Age: 3 full days → <b>− 6</b></li>
          </ul>
          <p className="mt-2 font-semibold text-stone-900">Score = 92 + 15 + 0 − 6 = 101</p>
        </div>

        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-700">
          <li>The age penalty is recalculated every hour, so the order stays current.</li>
          <li>If the rule check downgrades an &ldquo;asking for an app&rdquo; tag to a nutrition question, fit is capped at 50 first.</li>
          <li>Today shows the top {TOP_N}, by score or by newest comment, whichever you pick.</li>
          <li><b>Skip</b> hides a card once you have looked at it. Whether you approached the person is never recorded.</li>
        </ul>
      </Section>

      {/* system */}
      <Section title="System check">
        <div className={box}>
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
      <td className="px-3 py-2 font-medium">{INTENT_LABEL[g] ?? g}</td>
      <td className="px-3 py-2 italic text-stone-600">&ldquo;{ex}&rdquo;</td>
      <td className="px-3 py-2">{what}</td>
    </tr>
  );
}

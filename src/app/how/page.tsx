import { aiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { CONFIG, RETENTION_DAYS, TOP_N } from "@/lib/config";
import { envPresence } from "@/lib/env";
import { Section } from "@/components/stat";

export const dynamic = "force-dynamic";

const JOBS = [
  { name: "Read comments", when: "Every 2 hours", what: "Checks which watched videos got new comments, reads them, filters them, sends the survivors to Gemini." },
  { name: "Find new videos", when: "Every 6 hours", what: "Searches each topic for videos uploaded since the last look." },
  { name: "Find older videos", when: "Every 2 hours, until done", what: "Works backwards month by month to January 2026. Switches itself off when finished." },
  { name: "Follow channels", when: "Once a day", what: "Reads the newest uploads from channels that have made a video on our topics." },
  { name: "Catch up", when: "Every hour", what: "Sends anything still waiting to Gemini and refreshes the scores." },
  { name: "Clean up", when: "Once a day", what: `Deletes comments ${RETENTION_DAYS} days after YouTube last showed them.` },
];

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-stone-500";
const td = "px-3 py-2 align-top";
const box = "rounded-xl border border-stone-200 bg-white p-4 text-sm";
const wrap = "overflow-x-auto rounded-xl border border-stone-200 bg-white";

export default async function HowPage() {
  await requireUser();
  const ai = aiConfigured();
  const keys = envPresence().filter((k) => k.required || k.present);

  return (
    <div>
      <h1 className="text-2xl font-semibold">How it works</h1>
      <p className="mt-1 max-w-2xl text-sm text-stone-600">
        The tool watches YouTube videos about diabetes, PCOS and thyroid diets, reads the comments under them, and shows you the ones where someone is asking a question Hash can answer. You decide whom to approach. The tool never writes or posts anything.
      </p>

      <Section title="1 · What we search for">
        <div className={box}>
          <ol className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={box}>
            <div className="text-xs font-semibold uppercase text-emerald-800">New videos</div>
            <p className="mt-2 text-stone-700">Every few hours we search each topic for videos uploaded since we last looked, so a new video reaches the list within hours. We also follow the channels that make these videos and check their new uploads daily.</p>
          </div>
          <div className={box}>
            <div className="text-xs font-semibold uppercase text-emerald-800">Older videos</div>
            <p className="mt-2 text-stone-700">YouTube search only shows about 500 results per search, so it cannot list everything at once. We work backwards one month at a time, down to January 2026. This runs once and then stops.</p>
          </div>
        </div>
      </Section>

      <Section title="3 · What runs automatically">
        <div className={wrap}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Job</th>
                <th className={th}>How often</th>
                <th className={th}>What it does</th>
              </tr>
            </thead>
            <tbody className="text-stone-700">
              {JOBS.map((j) => (
                <tr key={j.name} className="border-t border-stone-100">
                  <td className={`${td} whitespace-nowrap font-medium`}>{j.name}</td>
                  <td className={`${td} whitespace-nowrap`}>{j.when}</td>
                  <td className={td}>{j.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-500">A timer inside the database runs these on its own. Nobody presses anything.</p>
      </Section>

      <Section title="4 · How we read the comments">
        <div className={box}>
          <ul className="list-disc space-y-1.5 pl-5 text-stone-700">
            <li>We check whether a watched video has new comments, and read only the new ones.</li>
            <li>We keep the comment text, the time, the likes and which video it came from.</li>
            <li><b>We never store the commenter&apos;s name.</b> Comments by the video&apos;s own creator are dropped.</li>
            <li>Comments are deleted {RETENTION_DAYS} days after YouTube last showed them, as YouTube requires.</li>
          </ul>
        </div>
      </Section>

      <Section title="5 · How we decide what to show">
        <p className="mb-3 max-w-2xl text-sm text-stone-600">
          Most comments under these videos are praise or chatter. Two checks remove them. The first is a simple word check on our own server and costs nothing — it removes about 99 out of every 100 comments. Only what survives is sent to Gemini.
        </p>
        <div className={wrap}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Check</th>
                <th className={th}>A comment is dropped when</th>
              </tr>
            </thead>
            <tbody className="text-stone-700">
              <tr className="border-t border-stone-100">
                <td className={`${td} font-medium`} rowSpan={4}>Word check<br /><span className="text-xs font-normal text-stone-500">free, no AI</span></td>
                <td className={td}>It is very short, or posted before January 2026</td>
              </tr>
              <tr className="border-t border-stone-100"><td className={td}>It mentions no medicine, condition, app or food (metformin, PCOS, thyroid, rice, roti&hellip;)</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>It does not look like a question</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>It is spam (giveaway, promo code, crypto&hellip;)</td></tr>
              <tr className="border-t border-stone-200">
                <td className={`${td} font-medium`} rowSpan={2}>Gemini</td>
                <td className={td}>It is not really a question for us — praise, chit-chat, off topic</td>
              </tr>
              <tr className="border-t border-stone-100"><td className={td}><b>Not suitable:</b> asks for a dosage or a diagnosis, describes an emergency, or is about eating disorders, mental health, pregnancy or a child</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-500">Dropped comments never appear on Today. The YouTube page shows them, without a link, under &ldquo;Recently dropped&rdquo;.</p>
      </Section>

      <Section title="6 · What Gemini does">
        <div className={box}>
          <p className="text-stone-700">
            Gemini reads each surviving comment once and answers a few fixed questions about it. It does not find videos, does not do the word check, does not calculate the score, and never writes a reply.
          </p>
          <ul className="mt-3 grid gap-1.5 text-stone-700 sm:grid-cols-2">
            <li className="rounded-lg bg-stone-50 px-3 py-2">What kind of question is this?</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2">Which conditions and medicines are named?</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2">How well does Hash answer it? (the <b>fit</b>, 0 to 100)</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2">Is it urgent?</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2">Is this person suitable to approach?</li>
            <li className="rounded-lg bg-stone-50 px-3 py-2">One line saying what is being asked</li>
          </ul>
          <div className={`${wrap} mt-3`}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Kind of question</th>
                  <th className={th}>Example</th>
                </tr>
              </thead>
              <tbody className="text-stone-700">
                <tr className="border-t border-stone-100"><td className={`${td} font-medium`}>Medicine + food</td><td className={`${td} italic text-stone-600`}>&ldquo;Can I keep eating rice on metformin?&rdquo;</td></tr>
                <tr className="border-t border-stone-100"><td className={`${td} font-medium`}>Asking for an app</td><td className={`${td} italic text-stone-600`}>&ldquo;Which app understands Indian food?&rdquo;</td></tr>
                <tr className="border-t border-stone-100"><td className={`${td} font-medium`}>Complaint about an app</td><td className={`${td} italic text-stone-600`}>&ldquo;Cal AI keeps calling my dal pasta&rdquo;</td></tr>
                <tr className="border-t border-stone-100"><td className={`${td} font-medium`}>Nutrition question</td><td className={`${td} italic text-stone-600`}>&ldquo;Is oats good for weight loss?&rdquo;</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section title="7 · How the score is calculated">
        <p className="mb-3 max-w-2xl text-sm text-stone-600">
          The score is the number on each card. It decides the order of the list. Gemini gives the fit; the rest is simple arithmetic done by the app.
        </p>
        <div className={wrap}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>Step</th>
                <th className={th}>Points</th>
              </tr>
            </thead>
            <tbody className="text-stone-700">
              <tr className="border-t border-stone-100"><td className={td}><b>Start with the fit</b> from Gemini — how well Hash answers this exact question</td><td className={`${td} whitespace-nowrap font-semibold`}>0 to 100</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Add for a medicine + food question</td><td className={`${td} whitespace-nowrap font-semibold`}>+ 15</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Add for asking for an app</td><td className={`${td} whitespace-nowrap font-semibold`}>+ 10</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Add for a complaint about an app</td><td className={`${td} whitespace-nowrap font-semibold`}>+ 5</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Add if urgent</td><td className={`${td} whitespace-nowrap font-semibold`}>+ 3 or + 6</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Subtract for every day since the comment was posted (stops after 7 days)</td><td className={`${td} whitespace-nowrap font-semibold`}>− 2 per day</td></tr>
            </tbody>
          </table>
        </div>

        <div className={`${box} mt-3`}>
          <div className="text-xs font-semibold uppercase text-emerald-800">Example</div>
          <p className="mt-1 text-stone-700">&ldquo;I take metformin, can I eat mango at night?&rdquo; — posted 3 days ago</p>
          <p className="mt-2 text-stone-700">Fit <b>92</b> &nbsp;+&nbsp; medicine + food <b>15</b> &nbsp;+&nbsp; not urgent <b>0</b> &nbsp;−&nbsp; 3 days old <b>6</b></p>
          <p className="mt-1 text-base font-semibold text-stone-900">Score = 101</p>
        </div>

        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-700">
          <li>Scores are refreshed every hour, so newer comments keep moving up.</li>
          <li>Today shows the top {TOP_N}. You can sort by score or by newest.</li>
          <li><b>Skip</b> hides a card once you have looked at it. Whether you approached the person is never recorded.</li>
        </ul>
      </Section>

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

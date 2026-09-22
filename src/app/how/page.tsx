import type { Metadata } from "next";
import {
  BookOpen,
  Bot,
  Calculator,
  CalendarClock,
  CircleCheck,
  CircleX,
  Filter,
  History,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Tv,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { aiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { CONFIG, RETENTION_DAYS, SHORTLIST } from "@/lib/config";
import { envPresence } from "@/lib/env";
import { PageHeader, Section } from "@/components/stat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "How it works" };

const JOBS: Array<{ name: string; when: string; what: string; icon: LucideIcon }> = [
  { name: "Read comments", when: "Every 2 hours", what: "Checks which watched videos got new comments, reads them, filters them, sends the survivors to Gemini.", icon: MessageSquareText },
  { name: "Find new videos", when: "Every 6 hours", what: "Searches each topic for videos uploaded since the last look.", icon: Search },
  { name: "Find older videos", when: "Every 2 hours, until done", what: "Works backwards month by month to January 2026. Switches itself off when finished.", icon: History },
  { name: "Follow channels", when: "Once a day", what: "Reads the newest uploads from channels that have made a video on our topics.", icon: Tv },
  { name: "Catch up", when: "Every hour", what: "Sends anything still waiting to Gemini and refreshes the scores.", icon: RefreshCw },
  { name: "Clean up", when: "Once a day", what: `Deletes comments ${RETENTION_DAYS} days after YouTube last showed them. Stops following channels that have gone quiet.`, icon: Trash2 },
  { name: "Coverage check", when: "Once a week", what: "Compares the real upload lists of 20 followed channels with the watch list, to catch anything the searches missed.", icon: ShieldCheck },
];

const th = "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-stone-500";
const td = "px-4 py-3 align-top";
const box = "rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-stone-200";
const wrap = "overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-stone-200";
const thead = "bg-stone-50";

export default async function HowPage() {
  await requireUser();
  const ai = aiConfigured();
  const keys = envPresence().filter((k) => k.required || k.present);

  return (
    <div>
      <PageHeader icon={<BookOpen className="size-5 text-emerald-700" aria-hidden />} title="How it works">
        The tool watches YouTube videos about diabetes, PCOS and thyroid diets, reads the comments under them, and shows you the ones where someone is asking a question Hash can answer. You decide whom to approach. The tool never writes or posts anything.
      </PageHeader>

      <Section step={1} icon={Search} title="What we search for">
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CONFIG.youtube_topics.map((t, i) => (
            <li key={t} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-stone-200">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">{i + 1}</span>
              <span className="font-medium text-stone-800">{t}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section step={2} icon={Video} title="How we find the videos">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={box}>
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <Sparkles className="size-4 text-emerald-700" aria-hidden />
              New videos
            </div>
            <p className="mt-2 leading-relaxed text-stone-600">Every few hours we search each topic for videos uploaded since we last looked, so a new video reaches the list within hours. We also follow the channels that make these videos and check their new uploads daily.</p>
          </div>
          <div className={box}>
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <History className="size-4 text-emerald-700" aria-hidden />
              Older videos
            </div>
            <p className="mt-2 leading-relaxed text-stone-600">YouTube search only shows about 500 results per search, so it cannot list everything at once. We work backwards one month at a time, down to January 2026. This runs once and then stops.</p>
          </div>
        </div>
      </Section>

      <Section step={3} icon={Timer} title="What runs automatically" description="A timer inside the database runs these on its own. Nobody presses anything.">
        <ul className="grid gap-2">
          {JOBS.map((j) => (
            <li key={j.name} className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-stone-200">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-700">
                <j.icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-stone-900">{j.name}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    <CalendarClock className="size-3" aria-hidden />
                    {j.when}
                  </span>
                </div>
                <p className="mt-1 text-stone-600">{j.what}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section step={4} icon={MessageSquareText} title="How we read the comments">
        <div className={box}>
          <ul className="space-y-2 text-stone-700">
            {[
              <>We check whether a watched video has new comments, and read only the new ones.</>,
              <>We keep the comment text, the time, the likes and which video it came from.</>,
              <>
                <b>We never store the commenter&apos;s name.</b> Comments by the video&apos;s own creator are dropped.
              </>,
              <>Comments are deleted {RETENTION_DAYS} days after YouTube last showed them, as YouTube requires.</>,
            ].map((line, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        step={5}
        icon={Filter}
        title="How we decide what to show"
        description="Most comments under these videos are praise or chatter. Two checks remove them. The first is a simple word check on our own server and costs nothing — it removes about 99 out of every 100 comments. Only what survives is sent to Gemini."
      >
        <div className={wrap}>
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className={th}>Check</th>
                <th className={th}>A comment is dropped when</th>
              </tr>
            </thead>
            <tbody className="text-stone-700">
              <tr className="border-t border-stone-100">
                <td className={`${td} font-medium`} rowSpan={4}>
                  <span className="flex items-center gap-1.5">
                    <Filter className="size-4 text-stone-500" aria-hidden />
                    Word check
                  </span>
                  <span className="text-xs font-normal text-stone-500">free, no AI</span>
                </td>
                <td className={td}>It is very short, or posted before January 2026</td>
              </tr>
              <tr className="border-t border-stone-100"><td className={td}>It mentions no medicine, condition, app or food (metformin, PCOS, thyroid, rice, roti&hellip;)</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>It does not look like a question</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>It is spam (giveaway, promo code, crypto&hellip;)</td></tr>
              <tr className="border-t border-stone-200">
                <td className={`${td} font-medium`} rowSpan={2}>
                  <span className="flex items-center gap-1.5">
                    <Bot className="size-4 text-stone-500" aria-hidden />
                    Gemini
                  </span>
                </td>
                <td className={td}>It is not really a question for us — praise, chit-chat, off topic</td>
              </tr>
              <tr className="border-t border-stone-100"><td className={td}><b>Not suitable:</b> asks for a dosage or a diagnosis, describes an emergency, or is about eating disorders, mental health, pregnancy or a child</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-600">Dropped comments never appear on the Shortlist or in the YouTube list. The YouTube page shows them, without a link, under &ldquo;Recently dropped&rdquo;.</p>
      </Section>

      <Section step={6} icon={Bot} title="What Gemini does">
        <div className={box}>
          <p className="leading-relaxed text-stone-700">
            Gemini reads each surviving comment and answers a few fixed questions about it. It does not find videos, does not do the word check, does not calculate the score, and never writes a reply.
          </p>
          <p className="mt-2 leading-relaxed text-stone-700">
            One rule check runs on its answer: if Gemini calls a comment an app question but the comment names no app or tracker, the app files it as a medicine + food question (when a medicine or condition is named) or as a nutrition question with the fit capped at 50.
          </p>
          <ul className="mt-4 grid gap-2 text-stone-700 sm:grid-cols-2">
            {[
              <>What kind of question is this?</>,
              <>Which conditions and medicines are named?</>,
              <>
                How well does Hash answer it? (the <b>fit</b>, 0 to 100)
              </>,
              <>Is it urgent?</>,
              <>Is this person suitable to approach?</>,
              <>One line saying what is being asked</>,
            ].map((q, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2">
                <span className="text-xs font-semibold tabular-nums text-emerald-700">{i + 1}</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-stone-200">
            <table className="w-full text-sm">
              <thead className={thead}>
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

      <Section
        step={7}
        icon={Calculator}
        title="How the score is calculated"
        description="The score is the number on each card. It decides the order of the list. Gemini gives the fit; the rest is simple arithmetic done by the app."
      >
        <div className={wrap}>
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className={th}>Step</th>
                <th className={`${th} text-right`}>Points</th>
              </tr>
            </thead>
            <tbody className="text-stone-700">
              <tr className="border-t border-stone-100"><td className={td}><b>Start with the fit</b> from Gemini — how well Hash answers this exact question</td><td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums`}>0 to 100</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Add for a medicine + food question</td><td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-emerald-700`}>+ 15</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Add for asking for an app</td><td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-emerald-700`}>+ 10</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Add for a complaint about an app</td><td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-emerald-700`}>+ 5</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Add if urgent</td><td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-emerald-700`}>+ 3 or + 6</td></tr>
              <tr className="border-t border-stone-100"><td className={td}>Subtract for every day since the comment was posted (stops after 7 days)</td><td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-red-700`}>− 2 per day</td></tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 rounded-2xl bg-emerald-50 p-5 text-sm ring-1 ring-emerald-200">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Example</div>
          <p className="mt-1.5 text-stone-800">&ldquo;I take metformin, can I eat mango at night?&rdquo; — posted 3 days ago</p>
          <p className="mt-2 text-stone-700">
            Fit <b>92</b> &nbsp;+&nbsp; medicine + food <b>15</b> &nbsp;+&nbsp; not urgent <b>0</b> &nbsp;−&nbsp; 3 days old <b>6</b>
          </p>
          <p className="mt-2 text-lg font-semibold text-emerald-900">Score = 101</p>
        </div>

        <ul className="mt-4 space-y-2 text-sm text-stone-700">
          <li className="flex items-start gap-2.5">
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-stone-400" aria-hidden />
            <span>Scores are refreshed every hour, so newer comments keep moving up.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Users className="mt-0.5 size-4 shrink-0 text-stone-400" aria-hidden />
            <span>
              The <b>Shortlist</b> shows medicine + food, app and complaint questions with a score of {SHORTLIST.min_score} or more, posted in the last {SHORTLIST.max_age_days} days. The YouTube page shows everyone, {SHORTLIST.page_size} a page, with filters. Both can be sorted by score or by newest.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-stone-400" aria-hidden />
            <span>
              <b>Mark as read</b> moves a card to the Read page once you have looked at it, and <b>Move back</b> returns it. Whether you approached the person is never recorded.
            </span>
          </li>
        </ul>
      </Section>

      <Section icon={ShieldCheck} title="System check">
        <div className={box}>
          <p className="flex items-center gap-2 text-stone-700">
            {ai.ok ? <CircleCheck className="size-4 text-emerald-600" aria-hidden /> : <CircleX className="size-4 text-red-600" aria-hidden />}
            <span>
              AI provider: <b>{ai.provider}</b>, {ai.ok ? <span className="text-emerald-700">ready{ai.keys && ai.keys > 1 ? ` (${ai.keys} keys rotated)` : ""}</span> : <span className="text-red-700">not set: {ai.reason}</span>}
            </span>
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {keys.map((k) => (
              <li key={k.key} className="flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-2">
                {k.present ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="present" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-red-600" aria-label="missing" />}
                <span className="min-w-0">
                  <code className="block truncate text-xs font-semibold text-stone-800">{k.key}</code>
                  <span className="text-xs text-stone-500">{k.note ?? k.purpose}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-stone-500">Values are never shown. They live in the host&apos;s environment variables.</p>
        </div>
      </Section>
    </div>
  );
}

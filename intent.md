# Intent: Hash Growth Radar

The idea behind this tool, in plain words: what we want, why, and the lines we will not cross. The technical plan that turns this into software is in [spec.md](spec.md).

Written 22 Sep 2026.

---

## 1. The problem

Hash Health makes a food-logging app that checks every meal against the medicines a person takes and the conditions they have: type 2 diabetes, PCOS, hypothyroidism, high blood pressure and similar. The meals it understands are Indian ones, such as roti, dal and biryani.

Every day, people ask exactly the question Hash answers, in public. Examples:

- "I take metformin, can I eat mango at night?"
- "PCOS hai, roti ya rice better?"
- "Which app understands dal and roti?"
- "Cal AI keeps calling my dal pasta."

They ask in the comments under YouTube videos about diabetes, PCOS and thyroid diets. Nobody at Hash has time to read thousands of comments a day to find them.

## 2. What we want

A private tool that does the reading for us and shows the team **the few people worth approaching today**:

1. Find every YouTube video about Hash's topics, old and new.
2. Read every new comment under those videos.
3. Throw away praise, chatter and spam cheaply, without AI.
4. Let an AI describe each remaining **question**: what kind it is, which medicine or condition it names, and how well Hash answers it.
5. Rank them, and show the best recent ones on one short list.
6. A person on the team opens the comment on YouTube and decides, alone, whether and how to reply.

## 3. Who uses it

- **The Hash team.** They open the Shortlist, read a card, open the thread, and press Mark as read when done. Read comments stay on a Read page and can be moved back.
- **The founder.** They look at the counts and the How it works page to judge whether the channel is worth the team's time, and they decide which new sources to try.

## 4. What success looks like

- The Shortlist holds a number a person can work through, currently about 140. It does not hold the whole list, which was 2,446 on 21 Sep 2026.
- Every card on it is a real food question tied to a medicine, condition or app, posted recently.
- Nothing unsafe reaches the list: no dosage questions, diagnoses, emergencies, mental health, pregnancy or children.
- It costs nothing to run: YouTube's free allowance, Gemini's free tier, and Supabase's and Vercel's free plans.
- The team trusts the numbers. A count in a filter always matches the rows it gives.

## 5. The lines we do not cross

These are decisions, not preferences. The code enforces them.

- **The tool never writes, suggests or posts a reply.** A human decides everything.
- **We tag the question, never the person.** No username or commenter ID is stored anywhere.
- **Unsafe topics are never shown.** A comment about a dose, starting or stopping a medicine, side effects, a diagnosis, lab results, an emergency, an eating disorder, mental health, pregnancy, breastfeeding or a child is marked "not suitable" and kept off the list. This follows Hash's own medical disclaimer.
- **Stored comments are deleted 30 days after YouTube last returned them.** This is YouTube's Developer Policy III.E.4.d.
- **We stay inside the free YouTube allowance.** That is 100 searches and 10,000 units a day, and we stop at 95 and 9,000.
- **Only official, allowed doors.** No scraping and no terms-of-service workarounds. A source without a legal automatic door is not used.
- **Nothing from before 1 January 2026.**

## 6. Scope

**In scope now**

- YouTube only: comments under videos on six search phrases, plus the channels that made those videos.
- Four pages. **Shortlist** holds the best recent comments. **YouTube** holds everyone found, with filters. **Read** holds what the team has finished with. **How it works** is a plain explanation plus a system check.
- Every card can be understood without training: a ? button explains the colours and the score.
- Runs on a schedule. Nobody presses a button.

**Out of scope, by decision**

- Replying, drafting replies, or tracking who was approached.
- A settings page. Topics and keyword lists are edited in code.
- A login, for now. The URL is kept private.

**Sources checked and not used**, with the reason from each platform's own docs:

| Source | Why not |
|---|---|
| Reddit | Commercial use needs approval and a contract. Reddit's Public Content Policy bans licensees from targeting people by health. Reddit Pro is a beta with a waitlist. |
| Instagram | The API reads only your own content. Hashtag search is limited and gives no usernames. |
| Facebook Groups | The Groups API was removed on 22 Apr 2024. |
| X | Possible, but paid per post read. |
| Threads | Possible after Meta App Review. Health keywords may be blocked as "sensitive". Not yet applied for. |
| Telegram, Discord | A bot only sees groups it is added to. Discord's terms ban scraping. |
| Bluesky | Works with a login, but the audience is small and has almost no Indian users. It was tried locally and removed. |
| Health forums | No API, or automation is banned. |

## 7. Open questions

These are for the founder or the team to decide, not the code.

1. **Should age count for more?** The score loses 2 points a day, but only for 7 days. After that a six-month-old comment can outrank a fresh one. The Shortlist's 30-day window hides this for now.
2. **Should a second source be added?** Threads, after App Review, and X, paid, are the only live candidates.
3. **Should the AI change?** Gemini's free tier works today. Claude would cost money. Jev from TypeSafe cannot write the one-line summary, so it cannot fully replace Gemini.
4. **When should a login be added?**
5. **Should more search phrases and Hindi or Tamil keywords be added?** They were planned but not built.

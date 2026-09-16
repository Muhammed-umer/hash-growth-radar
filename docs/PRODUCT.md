# Hash Growth Radar

An internal tool for the Hash Health team. It finds the people online who need Hash today and shows them to you. You decide whom to approach and what to say. The tool never writes, suggests, or posts a reply.

## The problem

Hash Health does something no other calorie app does: it checks your food against your medications and health conditions. But almost nobody knows Hash exists, and there is no ad budget.

Every day, people post questions like:

- "I just started metformin. What should I eat?"
- "Is spinach safe with warfarin?"
- "Which calorie app actually understands Indian food?"
- "Any calorie app that knows my sugar tablets?"

These people are Hash's ideal users. They are asking for exactly what Hash does. But their questions are scattered across hundreds of communities, and the team never sees them.

## What the tool does

1. **Finds** those conversations in YouTube comments, automatically, every 2 hours.
2. **Ranks** them by how well they match Hash, and keeps only the best 10 per day.
3. **Shows** you each one: where they asked, what they asked, which medicine or condition, a fit score, and the link. Nothing else.

That is the whole job. It runs by itself on a schedule. You open the thread and approach the person yourself, in your own words, from your own account.

## Where we search

| Platform | What we look for | How |
|---|---|---|
| **YouTube comments** | Questions under videos found by nine search phrases: diabetes diet, type 2 diabetes what to eat, PCOS diet plan, thyroid diet, hypothyroidism diet, Indian weight loss diet, calorie tracking app review, Cal AI review, HealthifyMe review | Automatic, every 2 hours |

Looked at and dropped on 16 Sep 2026: Reddit (API needs Reddit's approval, weeks and not guaranteed), Hacker News (too few of Hash's people), App Store and Play Store (no free legal way to read other apps' reviews, and no way to contact a reviewer), Product Hunt (non-commercial API, tiny volume).

## How we search

- **Topics**: the nine YouTube search phrases above, kept in the code.
- **Search phrases**: things like "metformin diet", "warfarin vitamin K", "levothyroxine food", "best calorie tracker", "MyFitnessPal alternative", "calorie app Indian food".
- **Fresh only**: comments from the last 7 days, never the same comment twice.
- **Noise filter first**: obvious off-topic items are dropped before anything else happens.
- **Understanding, not keywords**: each remaining comment is read by a small free AI model and tagged: what is being asked, which condition or medicine is involved, does it mention a competitor, and a fit score from 0 to 100.
- **Top 10 only**: you see the highest-scoring items, nothing else.

## Schedule

Once deployed, the database's own scheduler (Supabase Cron) wakes the app: collect YouTube and tag every 2 hours, finish leftover tagging every hour, delete items older than 7 days once a day. No button pressing.

## Your daily flow

1. Open **Today**. Ten cards, each with the original post, its tags, and an "Open thread" button.
2. Read. Open the thread. Approach the person if you want to, your way.
3. Press **Skip** so the card leaves the list, whether you approached the person or not.

## Rules we never break

- The tool finds people. It never writes, suggests, or posts a reply. What you say is never stored.
- We always use each platform's official door. We never scrape pages.
- We tag the question, never the person. No usernames stored, no profiles built, everything deleted after 7 days.
- People asking for a dosage, a diagnosis, or in an emergency are never put on the list.

## What success looks like after 30 days

- 7 of the daily top 10 are really worth approaching
- under 10 minutes a day to go through the list
- zero manual runs needed once deployed

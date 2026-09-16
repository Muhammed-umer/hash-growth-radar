-- Hash Growth Radar — the whole database schema, as it is today (16 Sep 2026).
-- Paste this file into Supabase → SQL Editor → Run. On a fresh project it
-- builds everything; on an existing project it changes nothing (every
-- statement is "if not exists" / "or replace"), so it is safe to run again.
--
-- Matches src/lib/types.ts. Privacy rule (docs/overview.html): we tag the
-- QUESTION, never the PERSON. There is deliberately no author / username
-- column anywhere in this schema, and the cleanup cron deletes items after 7 days.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- items: one row per collected post / comment
-- ---------------------------------------------------------------------------
create table if not exists items (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null check (platform in ('reddit', 'youtube')),
  source_kind   text not null default 'auto' check (source_kind in ('auto', 'manual')),
  external_id   text not null,                 -- YouTube comment id, Reddit post/comment id, or a url:/text: hash for pastes
  url           text,
  community     text,                          -- "r/type2diabetes" or "YouTube · Channel Name"
  title         text,
  body          text,
  posted_at     timestamptz,
  collected_at  timestamptz not null default now(),
  -- filtered: dropped by the keyword filter or tagged irrelevant
  -- queued: waiting for the AI · tagged: on the list · do_not_reply: not suitable to approach
  -- skipped: you passed on it · posted: you approached this person (name kept for the database)
  status        text not null default 'queued'
                check (status in ('filtered', 'queued', 'tagged', 'do_not_reply', 'skipped', 'posted')),
  filter_reason text,
  score         numeric,
  meta          jsonb not null default '{}'::jsonb,   -- e.g. {"video_id": "...", "video_title": "...", "topic": "..."}
  unique (platform, external_id)
);
create index if not exists items_platform_status_score on items (platform, status, score desc nulls last);
create index if not exists items_collected_at on items (collected_at);
create index if not exists items_status_score on items (status, score desc nulls last);

-- ---------------------------------------------------------------------------
-- tags: the AI's description of the QUESTION in an item (one per item)
-- ---------------------------------------------------------------------------
create table if not exists tags (
  item_id             uuid primary key references items(id) on delete cascade,
  intent              text not null
                      check (intent in ('medicine_food_question', 'app_recommendation', 'nutrition_question', 'competitor_complaint', 'irrelevant')),
  conditions          text[] not null default '{}',
  medicines           text[] not null default '{}',
  competitor          text,
  fit_score           int  not null check (fit_score between 0 and 100),
  urgency             text not null default 'low' check (urgency in ('low', 'medium', 'high')),
  language            text check (language is null or language in ('en', 'hinglish', 'other')),
  do_not_reply        boolean not null default false,   -- true = not someone to approach (dosage, emergency, ...)
  do_not_reply_reason text,
  summary             text,
  model               text,
  raw                 jsonb,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- runs: one row per collection run, per platform (what the platform pages monitor)
-- ---------------------------------------------------------------------------
create table if not exists runs (
  id           uuid primary key default gen_random_uuid(),
  platform     text not null,
  trigger      text not null default 'cron' check (trigger in ('cron', 'manual', 'intake')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running' check (status in ('running', 'ok', 'error', 'skipped')),
  fetched      int not null default 0,
  stored       int not null default 0,
  duplicates   int not null default 0,
  filtered_out int not null default 0,
  queued       int not null default 0,
  tagged       int not null default 0,
  error        text,
  notes        jsonb
);
create index if not exists runs_platform_started on runs (platform, started_at desc);

-- ---------------------------------------------------------------------------
-- jobs: a small database-backed queue (claimed atomically with claim_jobs)
-- ---------------------------------------------------------------------------
create table if not exists jobs (
  id           bigserial primary key,
  type         text not null,                        -- 'classify'
  payload      jsonb not null default '{}'::jsonb,   -- {"item_id": "..."}
  status       text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  attempts     int not null default 0,
  max_attempts int not null default 3,
  run_after    timestamptz not null default now(),
  locked_at    timestamptz,
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists jobs_status_run_after on jobs (status, run_after);
create index if not exists jobs_status_updated on jobs (status, updated_at);

create or replace function claim_jobs(p_limit int, p_types text[] default null)
returns setof jobs
language plpgsql
as $$
begin
  return query
  with picked as (
    select j.id
    from jobs j
    where j.status = 'pending'
      and j.run_after <= now()
      and (p_types is null or j.type = any (p_types))
    order by j.id
    limit p_limit
    for update skip locked
  )
  update jobs j
     set status = 'running',
         locked_at = now(),
         attempts = j.attempts + 1,
         updated_at = now()
    from picked
   where j.id = picked.id
  returning j.*;
end
$$;

-- ---------------------------------------------------------------------------
-- settings: key/value overrides for the defaults in src/lib/config.ts
-- ---------------------------------------------------------------------------
create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Aggregates used by the dashboard (avoid pulling every row to count it)
-- ---------------------------------------------------------------------------
create or replace function item_status_counts()
returns table (platform text, status text, n bigint)
language sql stable
as $$
  select i.platform, i.status, count(*)::bigint
  from items i
  group by i.platform, i.status
$$;

create or replace function job_counts()
returns table (status text, n bigint)
language sql stable
as $$
  select j.status, count(*)::bigint from jobs j group by j.status
$$;

-- ---------------------------------------------------------------------------
-- Lock everything down. The app talks to the database only from the server
-- with the service-role key, which bypasses RLS. With RLS enabled and no
-- policies, the public anon key can read nothing.
-- ---------------------------------------------------------------------------
alter table items    enable row level security;
alter table tags     enable row level security;
alter table runs     enable row level security;
alter table jobs     enable row level security;
alter table settings enable row level security;

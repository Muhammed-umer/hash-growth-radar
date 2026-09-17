-- Hash Growth Radar — the watch list (17 Sep 2026).
-- Paste into Supabase → SQL Editor → Run, AFTER 0001_schema.sql. Safe to run again.
--
-- What changes: videos are remembered (one `videos` table, by decision), the
-- channels behind them are followed, each topic keeps its search watermark,
-- the one-time month sweep keeps its page-by-page position, and every YouTube
-- call is counted in `quota_ledger` before it is made. Design: docs/coverage-plan.html.
--
-- Privacy rule unchanged: no commenter name or id anywhere. `channels` holds the
-- channel that PUBLISHED a video (a public creator account), never a commenter.

-- ---------------------------------------------------------------------------
-- topics: the 6 search phrases (seeded from src/lib/config.ts by the app)
-- ---------------------------------------------------------------------------
create table if not exists topics (
  phrase                   text primary key,
  language                 text not null default 'en',      -- relevanceLanguage for search.list
  active                   boolean not null default true,
  last_new_search_at       timestamptz,                     -- watermark for "newest since last look" searches
  last_relevance_search_at timestamptz,
  sweep_seeded_at          timestamptz,                     -- when the month-sweep units were created
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- videos: every video we have ever seen, by id. Comments are read FROM this
-- table, never from a search result.
-- ---------------------------------------------------------------------------
create table if not exists videos (
  video_id           text primary key,
  channel_id         text,
  channel_title      text,                                 -- shown on the card as the "community"
  title              text,
  published_at       timestamptz,
  duration_seconds   int,
  is_short           boolean not null default false,       -- duration under 60 s: read weekly only
  is_live            boolean not null default false,       -- live / upcoming: skipped until it is a normal video
  topics             text[] not null default '{}',         -- phrases that found it ('{}' = found through a channel)
  found_via          text,                                 -- sweep | search_new | search_relevance | channel | coverage
  comment_count      int,                                  -- last value from videos.list (null = never checked or hidden)
  count_checked_at   timestamptz,
  last_change_at     timestamptz,                          -- last time comment_count moved
  last_read_at       timestamptz,
  newest_comment_at  timestamptz,                          -- cursor: newest comment already stored
  pending_newest_at  timestamptz,                          -- newest comment seen in a read that is not finished yet
  read_resume_token  text,                                 -- commentThreads.list pageToken of an unfinished read
  read_pages_total   int not null default 0,               -- pages used by the unfinished read (first-read cap)
  next_check_at      timestamptz not null default now(),
  status             text not null default 'active'
                     check (status in ('active', 'comments_disabled', 'gone', 'retired')),
  kept_items         int not null default 0,               -- comments from this video that passed the filter (yield)
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now()
);
create index if not exists videos_status_next_check on videos (status, next_check_at);
create index if not exists videos_channel on videos (channel_id);
create index if not exists videos_last_seen on videos (last_seen_at);

-- ---------------------------------------------------------------------------
-- channels: the creators behind on-topic videos. Their uploads playlist lists
-- every video they ever published for 1 unit per 50, no search needed.
-- ---------------------------------------------------------------------------
create table if not exists channels (
  channel_id          text primary key,
  title               text,
  uploads_playlist_id text,
  followed            boolean not null default false,      -- true once it has at least one on-topic video
  history_walked      boolean not null default false,      -- full uploads playlist read once
  last_swept_at       timestamptz,
  on_topic_videos     int not null default 0,
  last_on_topic_at    timestamptz,                         -- newest on-topic upload; unfollow after 120 days of silence
  first_seen_at       timestamptz not null default now(),
  last_seen_at        timestamptz not null default now()
);
create index if not exists channels_followed_swept on channels (followed, last_swept_at);
-- Added after the first version of this file: a history walk that runs out of
-- time continues from its saved page instead of starting over.
alter table channels add column if not exists walk_page_token text;
alter table channels add column if not exists walk_pages int not null default 0;

-- ---------------------------------------------------------------------------
-- sweep_units: the one-time month sweep, one row per (phrase, window, order).
-- The saved page_token is what lets a run stop anywhere and continue later.
-- ---------------------------------------------------------------------------
create table if not exists sweep_units (
  id               bigserial primary key,
  phrase           text not null,
  published_after  timestamptz not null,
  published_before timestamptz not null,
  order_by         text not null check (order_by in ('viewCount', 'date')),
  status           text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  page_token       text,
  pages_done       int not null default 0,
  videos_found     int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (phrase, published_after, published_before, order_by)
);
create index if not exists sweep_units_pick on sweep_units (status, published_before desc, id);

-- ---------------------------------------------------------------------------
-- quota_ledger: one row per quota day (Pacific time). Every call adds its cost
-- BEFORE it is made; jobs stop at 95 searches / 9,000 units.
-- ---------------------------------------------------------------------------
create table if not exists quota_ledger (
  quota_day  date primary key,
  searches   int not null default 0,
  units      int not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function spend_quota(p_day date, p_searches int, p_units int)
returns table (searches int, units int)
language sql
as $$
  insert into quota_ledger (quota_day, searches, units)
  values (p_day, greatest(p_searches, 0), greatest(p_units, 0))
  on conflict (quota_day) do update
     set searches = quota_ledger.searches + excluded.searches,
         units    = quota_ledger.units + excluded.units,
         updated_at = now()
  returning quota_ledger.searches, quota_ledger.units;
$$;

-- ---------------------------------------------------------------------------
-- items: link each comment to its video; refresh "last seen" so the 30-day
-- rule (YouTube Developer Policy III.E.4.d) counts from the last time YouTube
-- returned the comment, not from the first time we stored it.
-- ---------------------------------------------------------------------------
alter table items add column if not exists video_id text;
alter table items add column if not exists last_seen_at timestamptz not null default now();
create index if not exists items_video on items (video_id);
create index if not exists items_last_seen on items (last_seen_at);

-- runs: which job made the run (collect | sweep | discover | channels | coverage | cleanup)
alter table runs add column if not exists job text not null default 'collect';

-- ---------------------------------------------------------------------------
-- upsert_videos: one call stores a page of videos and their channels.
--   p_rows: [{video_id, channel_id, channel_title, title, published_at}]
--   p_topic: the phrase that found them (null when found through a channel)
--   p_found_via: sweep | search_new | search_relevance | channel | coverage
-- Returns how many were new. A known video gets the phrase added to its list
-- and its last_seen_at refreshed; a retired one comes back to active.
-- ---------------------------------------------------------------------------
create or replace function upsert_videos(p_rows jsonb, p_topic text, p_found_via text)
returns int
language plpgsql
as $$
declare
  v_inserted int := 0;
begin
  with src as (
    select distinct on (r.video_id) r.video_id, r.channel_id, r.channel_title, r.title, r.published_at
    from jsonb_to_recordset(p_rows) as r(video_id text, channel_id text, channel_title text, title text, published_at timestamptz)
    where r.video_id is not null
  ),
  ins as (
    insert into videos (video_id, channel_id, channel_title, title, published_at, topics, found_via)
    select s.video_id, s.channel_id, s.channel_title, s.title, s.published_at,
           case when p_topic is null then '{}'::text[] else array[p_topic] end,
           p_found_via
    from src s
    on conflict (video_id) do update
       set channel_id   = coalesce(excluded.channel_id, videos.channel_id),
           channel_title = coalesce(excluded.channel_title, videos.channel_title),
           title        = coalesce(excluded.title, videos.title),
           published_at = coalesce(excluded.published_at, videos.published_at),
           topics       = case when p_topic is null or p_topic = any (videos.topics) then videos.topics
                               else array_append(videos.topics, p_topic) end,
           last_seen_at = now(),
           status       = case when videos.status = 'retired' then 'active' else videos.status end,
           next_check_at = case when videos.status = 'retired' then now() else videos.next_check_at end
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted) into v_inserted from ins;

  insert into channels (channel_id, title)
  select distinct on (r.channel_id) r.channel_id, r.channel_title
  from jsonb_to_recordset(p_rows) as r(channel_id text, channel_title text)
  where r.channel_id is not null
  on conflict (channel_id) do update
     set title = coalesce(excluded.title, channels.title),
         last_seen_at = now();

  if p_topic is not null then
    update channels c
       set followed = true,
           on_topic_videos = (select count(*) from videos v where v.channel_id = c.channel_id and cardinality(v.topics) > 0),
           last_on_topic_at = (select max(v.published_at) from videos v where v.channel_id = c.channel_id and cardinality(v.topics) > 0)
     where c.channel_id in (
       select distinct r.channel_id from jsonb_to_recordset(p_rows) as r(channel_id text) where r.channel_id is not null
     );
  end if;

  return coalesce(v_inserted, 0);
end
$$;

-- Random followed channels for the weekly coverage check.
create or replace function random_followed_channels(p_n int)
returns setof channels
language sql stable
as $$
  select * from channels
  where followed and history_walked and uploads_playlist_id is not null
  order by random()
  limit p_n
$$;

-- Yield per video (how many of its comments passed the filter), refreshed by cleanup.
create or replace function refresh_video_yield()
returns void
language sql
as $$
  update videos v
     set kept_items = coalesce((
       select count(*) from items i
       where i.video_id = v.video_id and i.status in ('queued', 'tagged', 'skipped', 'posted')
     ), 0)
$$;

-- Numbers for the YouTube page.
create or replace function watchlist_stats()
returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'videos_total',      (select count(*) from videos),
    'videos_by_status',  coalesce((select jsonb_object_agg(s.status, s.n) from (select status, count(*) n from videos group by status) s), '{}'::jsonb),
    'videos_by_door',    coalesce((select jsonb_object_agg(coalesce(d.found_via, 'unknown'), d.n) from (select found_via, count(*) n from videos group by found_via) d), '{}'::jsonb),
    'channels_total',    (select count(*) from channels),
    'channels_followed', (select count(*) from channels where followed),
    'channels_walked',   (select count(*) from channels where followed and history_walked),
    'sweep_total',       (select count(*) from sweep_units),
    'sweep_done',        (select count(*) from sweep_units where status = 'done'),
    'sweep_videos',      (select coalesce(sum(videos_found), 0) from sweep_units),
    'last_coverage',     (select notes from runs where job = 'coverage' and status = 'ok' order by started_at desc limit 1)
  )
$$;

-- ---------------------------------------------------------------------------
-- Lock the new tables down like the others (service-role key only).
-- ---------------------------------------------------------------------------
alter table topics       enable row level security;
alter table videos       enable row level security;
alter table channels     enable row level security;
alter table sweep_units  enable row level security;
alter table quota_ledger enable row level security;

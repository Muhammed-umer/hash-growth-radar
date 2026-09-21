-- Hash Growth Radar — filter dropdown counts (21 Sep 2026).
-- Paste into Supabase → SQL Editor → Run, AFTER 0001_schema.sql. Safe to run again.
--
-- The platform page has three dropdowns: group, condition or medicine, and
-- minimum score. The counts shown in a dropdown are computed here from the
-- rows that match the OTHER dropdowns, so "metformin (38)" means 38 rows you
-- will actually get. Before this function existed the counts came from the
-- whole list and ignored the other two dropdowns (and stopped at 3,000 rows).
--
-- Until this file has been run, the app falls back to counting in JavaScript
-- with the same rules, reading every tagged row 1,000 at a time. The counts
-- are the same; it is just slower, and gets slower as the list grows.

create or replace function tag_facets(
  p_platform  text,
  p_intent    text    default null,
  p_min_score numeric default null,
  p_term      text    default null
)
returns table (kind text, value text, n bigint)
language sql stable
as $$
  with base as (
    select i.score, t.intent, t.conditions, t.medicines
    from items i
    join tags t on t.item_id = i.id
    where i.status = 'tagged'
      and i.platform = p_platform
      and (p_min_score is null or i.score >= p_min_score)
  ),
  -- for the condition / medicine dropdown: every filter except its own
  for_terms as (
    select * from base where p_intent is null or intent = p_intent
  ),
  -- for the group dropdown: every filter except its own
  for_groups as (
    select * from base
    where p_term is null or p_term = any (conditions) or p_term = any (medicines)
  )
  select 'condition'::text, c, count(*)::bigint from for_terms, unnest(conditions) as c group by c
  union all
  select 'medicine'::text,  m, count(*)::bigint from for_terms, unnest(medicines)  as m group by m
  union all
  select 'intent'::text, intent, count(*)::bigint from for_groups group by intent
$$;

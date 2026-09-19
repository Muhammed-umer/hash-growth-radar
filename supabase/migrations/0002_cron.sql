-- Supabase Cron: the database itself wakes the deployed app on a schedule.
-- Nothing else (no Vercel cron, no external scheduler) is needed.
--
-- BEFORE RUNNING, replace the placeholder below (or paste the git-ignored
-- 0002_cron.local.sql, which has it filled in):
--   <CRON_SECRET>  the same value as CRON_SECRET in the app's environment variables
-- The app URL (https://hash-growth-radar.vercel.app, no trailing slash) is
-- already filled in below; change it if the app moves.
--
-- Enable the Cron integration and the pg_net extension in the dashboard first.
-- Then paste into Supabase → SQL Editor → Run. Needs a deployed app: the
-- database cannot reach http://localhost. Locally, call the routes with curl.
-- Safe to run again later (for a new URL or secret): secrets are updated in
-- place and the seven jobs are replaced.
--
-- Checked against supabase.com/docs/guides/cron on 16 Sep 2026:
--   schedules from every second to once a year; keep each job under 10 minutes
--   and at most 8 running at once. pg_net sends the HTTP request asynchronously
--   and waits only timeout_milliseconds for the answer, which is why the app's
--   routes reply "started" immediately and do the work in the background.

-- The extensions are enabled from the dashboard, not here: Supabase runs the
-- install as its admin role. Installing from the SQL editor can fail with
-- "dependent privileges exist" once the extension has been removed and
-- re-added. This block only checks and tells you what to switch on.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is not enabled. Supabase dashboard -> Integrations -> Cron -> Enable (or Database -> Extensions -> pg_cron), then run this file again.';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net is not enabled. Supabase dashboard -> Database -> Extensions -> pg_net -> Enable, then run this file again.';
  end if;
end $$;

-- Store the app URL and secret once, encrypted in Vault, instead of inside
-- each job. Update if they already exist.
do $$
declare
  v_url uuid;
  v_secret uuid;
begin
  select id into v_url from vault.secrets where name = 'radar_app_url';
  if v_url is null then
    perform vault.create_secret('https://hash-growth-radar.vercel.app', 'radar_app_url');
  else
    perform vault.update_secret(v_url, 'https://hash-growth-radar.vercel.app');
  end if;

  select id into v_secret from vault.secrets where name = 'radar_cron_secret';
  if v_secret is null then
    perform vault.create_secret('<CRON_SECRET>', 'radar_cron_secret');
  else
    perform vault.update_secret(v_secret, '<CRON_SECRET>');
  end if;
end $$;

-- Remove earlier versions of these jobs so re-running this file is safe.
do $$
declare j text;
begin
  for j in select jobname from cron.job where jobname in
    ('radar_collect', 'radar_process', 'radar_cleanup', 'radar_sweep', 'radar_discover', 'radar_channels', 'radar_coverage') loop
    perform cron.unschedule(j);
  end loop;
end $$;

-- Run 0001_schema.sql and 0003_watchlist.sql first.
--
-- The jobs (docs/coverage-plan.html section 6). Times are UTC; the YouTube
-- quota day resets at 07:00 or 08:00 UTC (midnight Pacific), and the ledger in
-- the app counts per quota day, so no job needs to know the reset hour.
--
--   job              schedule          route                  what
--   radar_collect    0 */2 * * *       /api/cron/collect      job 6: count check + read changed videos + tag
--   radar_sweep      10 */2 * * *      /api/cron/sweep        job 1: month sweep, newest month first, until done
--   radar_discover   20 */6 * * *      /api/cron/discover     jobs 2+3: newest-since searches, relevance daily
--   radar_channels   30 8 * * *        /api/cron/channels     job 4: uploads playlists, daily page, history walks
--   radar_process    30 * * * *        /api/cron/process      leftover AI tagging
--   radar_cleanup    0 3 * * *         /api/cron/cleanup      job 7: 30-day purge, unfollow quiet channels
--   radar_coverage   0 9 * * 1         /api/cron/coverage     job 8: weekly miss-rate check
--
-- channels and coverage run just after the quota reset (08:30 and 09:00 UTC
-- are after midnight Pacific in both summer and winter), so they spend units
-- at the start of a quota day. The reader stops at 7,000 units a day and
-- leaves them at least 2,000.

create or replace function radar_schedule(p_name text, p_schedule text, p_path text, p_timeout_ms int)
returns void language plpgsql as $$
begin
  perform cron.schedule(
    p_name,
    p_schedule,
    format($job$
      select net.http_get(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'radar_app_url') || %L,
        headers := jsonb_build_object('Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'radar_cron_secret'), '')),
        timeout_milliseconds := %s
      );
    $job$, p_path, p_timeout_ms)
  );
end $$;

select radar_schedule('radar_collect',  '0 */2 * * *',  '/api/cron/collect',  10000);
select radar_schedule('radar_sweep',    '10 */2 * * *', '/api/cron/sweep',    10000);
select radar_schedule('radar_discover', '20 */6 * * *', '/api/cron/discover', 10000);
select radar_schedule('radar_channels', '30 8 * * *',   '/api/cron/channels', 10000);
select radar_schedule('radar_process',  '30 * * * *',   '/api/cron/process',  10000);
select radar_schedule('radar_cleanup',  '0 3 * * *',    '/api/cron/cleanup',  30000);
select radar_schedule('radar_coverage', '0 9 * * 1',    '/api/cron/coverage', 10000);

-- Check what is scheduled:      select jobname, schedule, active from cron.job;
-- See the last runs:            select jobname, status, start_time, return_message from cron.job_run_details order by start_time desc limit 20;
-- See the HTTP answers:         select id, status_code, created from net._http_response order by created desc limit 20;
--   (a 401 there means the secret in Vault and CRON_SECRET in the app differ)
-- Pause everything:             select cron.alter_job(jobid, active := false) from cron.job where jobname like 'radar_%';
-- Resume everything:            select cron.alter_job(jobid, active := true) from cron.job where jobname like 'radar_%';
-- Change a schedule later:      select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'radar_sweep'), schedule := '10 */4 * * *');

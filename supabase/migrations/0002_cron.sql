-- Supabase Cron: the database itself wakes the deployed app on a schedule.
-- Nothing else (no Vercel cron, no external scheduler) is needed.
--
-- BEFORE RUNNING, replace the placeholder below (or paste the git-ignored
-- 0002_cron.local.sql, which has it filled in):
--   https://hash-growth-radar.vercel.app      your deployed app, e.g. https://hash-growth-radar.vercel.app  (no trailing slash)
--   <CRON_SECRET>  the same value as CRON_SECRET in the app's environment variables
--
-- Then paste into Supabase → SQL Editor → Run. Needs a deployed app: the
-- database cannot reach http://localhost. Locally, use the "Run now" buttons.
-- Safe to run again later (for a new URL or secret): secrets are updated in
-- place and the three jobs are replaced.
--
-- Checked against supabase.com/docs/guides/cron on 16 Sep 2026:
--   schedules from every second to once a year; keep each job under 10 minutes
--   and at most 8 running at once. pg_net sends the HTTP request asynchronously
--   and waits only timeout_milliseconds for the answer, which is why the app's
--   routes reply "started" immediately and do the work in the background.

create extension if not exists pg_cron;
create extension if not exists pg_net;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

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
  for j in select jobname from cron.job where jobname in ('radar_collect', 'radar_process', 'radar_cleanup') loop
    perform cron.unschedule(j);
  end loop;
end $$;

-- Run 0001_schema.sql first.

-- 1. Collect YouTube + tag: every 2 hours (4 topic searches per run = 48 of the 100 free per day).
select cron.schedule(
  'radar_collect',
  '0 */2 * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'radar_app_url') || '/api/cron/collect',
    headers := jsonb_build_object('Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'radar_cron_secret'), '')),
    timeout_milliseconds := 10000
  );
  $$
);

-- 2. Finish any tagging that hit an AI rate limit: every hour at :30.
select cron.schedule(
  'radar_process',
  '30 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'radar_app_url') || '/api/cron/process',
    headers := jsonb_build_object('Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'radar_cron_secret'), '')),
    timeout_milliseconds := 10000
  );
  $$
);

-- 3. Delete items older than 7 days: daily at 03:00 UTC (08:30 IST).
select cron.schedule(
  'radar_cleanup',
  '0 3 * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'radar_app_url') || '/api/cron/cleanup',
    headers := jsonb_build_object('Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'radar_cron_secret'), '')),
    timeout_milliseconds := 30000
  );
  $$
);

-- Check what is scheduled:      select jobname, schedule, active from cron.job;
-- See the last runs:            select jobname, status, start_time, return_message from cron.job_run_details order by start_time desc limit 20;
-- See the HTTP answers:         select id, status_code, created from net._http_response order by created desc limit 20;
--   (a 401 there means the secret in Vault and CRON_SECRET in the app differ)
-- Change a schedule later:      select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'radar_collect'), schedule := '0 */4 * * *');

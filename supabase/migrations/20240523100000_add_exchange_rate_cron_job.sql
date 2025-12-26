-- supabase/migrations/20240523100001_fix_exchange_rate_cron_job.sql
-- This migration corrects the cron job for syncing exchange rates by using the anon_key as the JWT.

-- 1. Unschedule the old job to prevent it from running with incorrect credentials.
-- We use a DO block to ignore errors if the job doesn't exist.
DO $$
BEGIN
  PERFORM cron.unschedule('daily-exchange-rate-sync');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Job "daily-exchange-rate-sync" did not exist, skipping unschedule.';
END;
$$;


-- 2. Re-schedule the job with the correct headers, using anon_key for Authorization.
select
  cron.schedule(
    'daily-exchange-rate-sync', -- Job name
    '0 1 * * *',                -- Cron schedule: runs once a day at 1 AM UTC
    $$
    select
      net.http_post(
        url:= 'https://yelkjimxejmrkfzeumos.supabase.co/functions/v1/sync-historical-exchange-rates',
        headers:= '{
          "Content-Type": "application/json",
          "apikey": "3bdf4d03a67edf8a45418ae1be353127b54a846c5c71646f0df9b2f3a7e5f945",
          "Authorization": "Bearer 3bdf4d03a67edf8a45418ae1be353127b54a846c5c71646f0df9b2f3a7e5f945"
        }'::jsonb
      )
    $$
  );

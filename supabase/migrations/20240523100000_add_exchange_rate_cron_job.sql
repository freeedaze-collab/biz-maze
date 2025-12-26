-- supabase/migrations/20240523100000_add_exchange_rate_cron_job.sql
-- Enables required extensions and creates a cron job to sync exchange rates daily.

-- 1. Enable pg_cron extension if not already enabled, to allow scheduling tasks.
create extension if not exists pg_cron with schema extensions;

-- 2. Enable pg_net extension if not already enabled, to allow making HTTP requests.
create extension if not exists pg_net with schema extensions;

-- 3. Grant usage permissions to the postgres user for the new schemas.
grant usage on schema extensions to postgres;
grant usage on schema net to postgres;

-- 4. Schedule the daily job to call the edge function.
-- This now runs AFTER the extensions are guaranteed to be active.
select
  cron.schedule(
    'daily-exchange-rate-sync', -- Job name
    '0 1 * * *',                -- Cron schedule: runs once a day at 1 AM UTC
    $$
    select
      net.http_post(
        url:= 'https://ymddtgbsybvxfitgupqy.supabase.co/functions/v1/sync-historical-exchange-rates',
        headers:= '{
          "Content-Type": "application/json",
          "Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>"
        }'::jsonb
      )
    $$
  );

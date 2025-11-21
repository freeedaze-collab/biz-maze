-- Allow labeling/predictions for both wallet and exchange transactions via ctx_id keys
-- Adds ctx_id, relaxes NOT NULL on tx_id, and introduces unique keys for both tx_id and ctx_id paths

-- transaction_usage_labels adjustments
alter table if exists public.transaction_usage_labels
  add column if not exists ctx_id text;

-- allow either tx_id or ctx_id
alter table if exists public.transaction_usage_labels
  alter column tx_id drop not null;

-- drop legacy unique constraints if present (will replace with broader ones)
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'transaction_usage_labels_unique_tx'
  ) then
    alter table public.transaction_usage_labels drop constraint transaction_usage_labels_unique_tx;
  end if;
  if exists (
    select 1 from pg_constraint where conname = 'transaction_usage_labels_unique_ctx'
  ) then
    alter table public.transaction_usage_labels drop constraint transaction_usage_labels_unique_ctx;
  end if;
end $$;

-- ensure at least one identifier exists
alter table if exists public.transaction_usage_labels
  add constraint if not exists transaction_usage_labels_tx_or_ctx_check
  check (tx_id is not null or ctx_id is not null);

-- unique constraints & indexes (tx and ctx both allowed)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transaction_usage_labels_user_tx_unique'
  ) then
    alter table public.transaction_usage_labels
      add constraint transaction_usage_labels_user_tx_unique unique (user_id, tx_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'transaction_usage_labels_user_ctx_unique'
  ) then
    alter table public.transaction_usage_labels
      add constraint transaction_usage_labels_user_ctx_unique unique (user_id, ctx_id);
  end if;
end $$;

create unique index if not exists idx_tx_usage_labels_user_tx_unique
  on public.transaction_usage_labels (user_id, tx_id) where tx_id is not null;

create unique index if not exists idx_tx_usage_labels_user_ctx_unique
  on public.transaction_usage_labels (user_id, ctx_id) where ctx_id is not null;

create index if not exists idx_tx_usage_labels_ctx
  on public.transaction_usage_labels (ctx_id);

-- transaction_usage_predictions adjustments
alter table if exists public.transaction_usage_predictions
  add column if not exists ctx_id text;

alter table if exists public.transaction_usage_predictions
  alter column tx_id drop not null;

-- add surrogate primary key if missing (former PK was on user_id/tx_id/model)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transaction_usage_predictions' and column_name = 'id'
  ) then
    alter table public.transaction_usage_predictions add column id bigserial primary key;
  end if;
end $$;

-- drop legacy primary key so unique constraints can be redefined
DO $$
BEGIN
  IF exists (select 1 from pg_constraint where conname = 'transaction_usage_predictions_pkey') THEN
    alter table public.transaction_usage_predictions drop constraint transaction_usage_predictions_pkey;
  END IF;
END $$;

alter table if exists public.transaction_usage_predictions
  add constraint if not exists transaction_usage_predictions_tx_or_ctx_check
  check (tx_id is not null or ctx_id is not null);

DO $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transaction_usage_predictions_user_tx_model_unique'
  ) then
    alter table public.transaction_usage_predictions
      add constraint transaction_usage_predictions_user_tx_model_unique unique (user_id, tx_id, model);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'transaction_usage_predictions_user_ctx_model_unique'
  ) then
    alter table public.transaction_usage_predictions
      add constraint transaction_usage_predictions_user_ctx_model_unique unique (user_id, ctx_id, model);
  end if;
end $$;

create unique index if not exists idx_tx_usage_predictions_user_tx_model
  on public.transaction_usage_predictions (user_id, tx_id, model) where tx_id is not null;

create unique index if not exists idx_tx_usage_predictions_user_ctx_model
  on public.transaction_usage_predictions (user_id, ctx_id, model) where ctx_id is not null;

create index if not exists idx_tx_usage_predictions_ctx
  on public.transaction_usage_predictions (ctx_id);

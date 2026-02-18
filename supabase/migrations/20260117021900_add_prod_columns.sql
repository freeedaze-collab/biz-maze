-- Add missing columns from production schema for data import compatibility
--
-- This migration adds only the critical columns needed to import production data
-- without attempting complex type conversions that conflict with existing schema

-- Add email column to companies table (required by production data)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email text;

-- Add external_id to exchange_trades if it doesn't exist
ALTER TABLE public.exchange_trades ADD COLUMN IF NOT EXISTS external_id text;

-- Add updated_at to exchange_trades if it doesn't exist  
ALTER TABLE public.exchange_trades ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default now();

-- Add price_usd and value_usd to wallet_transactions if they don't exist
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS price_usd numeric;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS value_usd numeric;

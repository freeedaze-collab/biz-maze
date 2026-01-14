-- Add missing columns to profiles table for corporate account details
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'personal',
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS entity_type TEXT,
ADD COLUMN IF NOT EXISTS us_entity_type TEXT,
ADD COLUMN IF NOT EXISTS state_of_incorporation TEXT,
ADD COLUMN IF NOT EXISTS us_state_of_incorporation TEXT;

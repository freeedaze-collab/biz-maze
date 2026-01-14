-- Add company_name to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;

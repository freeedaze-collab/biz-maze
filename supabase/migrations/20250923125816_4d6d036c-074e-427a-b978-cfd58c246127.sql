-- Add tax_country and entity_type columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tax_country TEXT,
ADD COLUMN IF NOT EXISTS entity_type TEXT;
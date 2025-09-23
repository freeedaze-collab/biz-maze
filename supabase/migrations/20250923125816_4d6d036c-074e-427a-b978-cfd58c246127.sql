-- Add tax_country and entity_type columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN tax_country TEXT,
ADD COLUMN entity_type TEXT;
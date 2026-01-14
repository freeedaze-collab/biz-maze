-- Add is_head_office column to entities if missing
ALTER TABLE public.entities
ADD COLUMN IF NOT EXISTS is_head_office BOOLEAN DEFAULT false;

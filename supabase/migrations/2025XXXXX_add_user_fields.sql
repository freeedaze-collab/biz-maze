-- Add new columns to store country, user type, and related fields
ALTER TABLE public.users
  ADD COLUMN country TEXT NOT NULL DEFAULT 'Japan',
  ADD COLUMN user_type TEXT NOT NULL DEFAULT 'Individual',
  ADD COLUMN dependent_count INTEGER,
  ADD COLUMN rnd_expense NUMERIC;

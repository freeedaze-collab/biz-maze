-- PURPOSE: Fix for "Database error saving new user" during signup.
-- This script safely creates or replaces the function and trigger
-- responsible for creating a user profile after signup, ensuring it
-- correctly bypasses Row Level Security (RLS).

-- STEP 1: Create or replace the function to handle new user creation.
-- The "SECURITY DEFINER" setting is crucial. It allows the function to run
-- with the permissions of its creator (typically a superuser),
-- which lets it bypass the new user's restrictive RLS policies during insertion.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- This is the key fix.
SET search_path = public
AS $$
BEGIN
  -- Insert a new row into public.profiles, copying the id and email
  -- from the newly created user in auth.users.
  INSERT INTO public.profiles (user_id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- STEP 2: Create the trigger that calls the function after a new user signs up.
-- We drop the trigger first to ensure a clean re-creation, preventing conflicts.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

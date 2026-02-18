-- Check profiles table structure and constraints
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass;

-- Check if users exist in auth.users
SELECT COUNT(*) as user_count FROM auth.users;

-- Check profiles count
SELECT COUNT(*) as profile_count FROM public.profiles;

-- Check RLS policies on profiles
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles';

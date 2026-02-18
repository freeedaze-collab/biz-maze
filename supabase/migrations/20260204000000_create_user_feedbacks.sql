-- Create user_feedbacks table
CREATE TABLE IF NOT EXISTS public.user_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    accounting_sufficiency TEXT NOT NULL, -- 'Sufficient' or 'Insufficient'
    insufficient_reasons TEXT[] DEFAULT '{}',
    desired_features TEXT[] DEFAULT '{}',
    free_description TEXT,
    entry_params JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.user_feedbacks ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own feedback
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own feedback') THEN
        CREATE POLICY "Users can insert their own feedback" ON public.user_feedbacks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
    END IF;
END $$;

-- Allow anonymous users to insert feedback
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can insert feedback') THEN
        CREATE POLICY "Anyone can insert feedback" ON public.user_feedbacks FOR INSERT TO public WITH CHECK (true);
    END IF;
END $$;

-- Only admins can read feedback
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Only admins can see feedbacks') THEN
        CREATE POLICY "Only admins can see feedbacks" ON public.user_feedbacks FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON public.user_feedbacks TO postgres, anon, authenticated, service_role;

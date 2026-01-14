CREATE TABLE IF NOT EXISTS public.nonce_store (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nonce TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nonce_store ENABLE ROW LEVEL SECURITY;

-- Allow Service Role (functions) to access freely.
-- Users don't need direct access as the function handles it. 
-- But IF we wanted frontend to check, we could add policies. 
-- For now, no policies needed if only Service Role accesses it? 
-- Actually, RLS is enabled, so default deny. Function uses Service Role Key, so it bypasses RLS.

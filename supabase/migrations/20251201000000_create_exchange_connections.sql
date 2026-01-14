-- Create exchange_connections table
CREATE TABLE IF NOT EXISTS public.exchange_connections (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange TEXT NOT NULL,
  connection_name TEXT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  encrypted_blob TEXT,
  label TEXT,
  status TEXT DEFAULT 'active',
  external_user_id TEXT,
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exchange_connections ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own exchange connections') THEN
        CREATE POLICY "Users can manage their own exchange connections" ON public.exchange_connections FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exchange_connections_user_id ON public.exchange_connections(user_id);

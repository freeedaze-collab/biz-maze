-- Create entities table for Consolidated Accounting
CREATE TABLE IF NOT EXISTS public.entities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('personal', 'subsidiary')),
    parent_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT false,
    country TEXT,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own entities" ON public.entities;
CREATE POLICY "Users can view their own entities"
    ON public.entities FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own entities" ON public.entities;
CREATE POLICY "Users can insert their own entities"
    ON public.entities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own entities" ON public.entities;
CREATE POLICY "Users can update their own entities"
    ON public.entities FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own entities" ON public.entities;
CREATE POLICY "Users can delete their own entities"
    ON public.entities FOR DELETE
    USING (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_entities_user_id ON public.entities(user_id);
CREATE INDEX IF NOT EXISTS idx_entities_parent_id ON public.entities(parent_id);

-- Add entity_id to connections
ALTER TABLE public.wallet_connections 
ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;

ALTER TABLE public.exchange_connections 
ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES public.entities(id) ON DELETE SET NULL;


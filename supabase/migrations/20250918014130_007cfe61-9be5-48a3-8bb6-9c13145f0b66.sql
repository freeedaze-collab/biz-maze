-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wallet_connections table for connecting crypto wallets to user accounts
CREATE TABLE IF NOT EXISTS public.wallet_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  wallet_type TEXT NOT NULL, -- 'metamask', 'coinbase', 'exodus', etc.
  wallet_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  balance_usd DECIMAL(20,8) DEFAULT 0,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, wallet_address)
);

-- Create transactions table for storing transaction history
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  transaction_hash TEXT UNIQUE,
  transaction_type TEXT NOT NULL, -- 'send', 'receive', 'swap', 'stake'
  amount DECIMAL(20,8) NOT NULL,
  currency TEXT NOT NULL, -- 'ETH', 'BTC', 'USDT', etc.
  usd_value DECIMAL(20,2),
  from_address TEXT,
  to_address TEXT,
  gas_fee DECIMAL(20,8),
  gas_fee_usd DECIMAL(20,2),
  block_number BIGINT,
  transaction_status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  blockchain_network TEXT NOT NULL, -- 'ethereum', 'bitcoin', 'polygon', etc.
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create crypto_payments table for payment requests
CREATE TABLE IF NOT EXISTS public.crypto_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id TEXT,
  recipient_address TEXT NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  currency TEXT NOT NULL,
  usd_amount DECIMAL(20,2),
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  transaction_hash TEXT,
  wallet_address TEXT,
  gas_fee DECIMAL(20,8),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Create RLS policies for profiles table
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own profile') THEN
        CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own profile') THEN
        CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile') THEN
        CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    -- Create RLS policies for wallet_connections table
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own wallet connections') THEN
        CREATE POLICY "Users can view their own wallet connections" ON public.wallet_connections FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own wallet connections') THEN
        CREATE POLICY "Users can create their own wallet connections" ON public.wallet_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own wallet connections') THEN
        CREATE POLICY "Users can update their own wallet connections" ON public.wallet_connections FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own wallet connections') THEN
        CREATE POLICY "Users can delete their own wallet connections" ON public.wallet_connections FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- Create RLS policies for transactions table
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own transactions') THEN
        CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own transactions') THEN
        CREATE POLICY "Users can create their own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own transactions') THEN
        CREATE POLICY "Users can update their own transactions" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    -- Create RLS policies for crypto_payments table
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own crypto payments') THEN
        CREATE POLICY "Users can view their own crypto payments" ON public.crypto_payments FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own crypto payments') THEN
        CREATE POLICY "Users can create their own crypto payments" ON public.crypto_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own crypto payments') THEN
        CREATE POLICY "Users can update their own crypto payments" ON public.crypto_payments FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_wallet_connections_user_id ON public.wallet_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_connections_address ON public.wallet_connections(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_address ON public.transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON public.transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_user_id ON public.crypto_payments(user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
        CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_wallet_connections_updated_at') THEN
        CREATE TRIGGER update_wallet_connections_updated_at BEFORE UPDATE ON public.wallet_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_transactions_updated_at') THEN
        CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_crypto_payments_updated_at') THEN
        CREATE TRIGGER update_crypto_payments_updated_at BEFORE UPDATE ON public.crypto_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
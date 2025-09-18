import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface WalletConnection {
  id: string;
  wallet_address: string;
  wallet_type: string;
  wallet_name?: string;
  is_primary: boolean;
  balance_usd: number;
  last_sync_at?: string;
}

export function useWallet() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<WalletConnection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWallets();
    }
  }, [user]);

  const fetchWallets = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('wallet_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching wallets:', error);
      toast({
        title: "Error",
        description: "Failed to fetch wallet connections",
        variant: "destructive",
      });
    } else {
      setWallets(data || []);
    }
    setLoading(false);
  };

  const connectWallet = async (walletAddress: string, walletType: string, walletName?: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from('wallet_connections')
      .insert({
        user_id: user.id,
        wallet_address: walletAddress,
        wallet_type: walletType,
        wallet_name: walletName,
        is_primary: wallets.length === 0, // First wallet becomes primary
      });

    if (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: "Error",
        description: "Failed to connect wallet",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Success",
      description: "Wallet connected successfully",
    });
    
    await fetchWallets();
    return true;
  };

  const syncWalletBalance = async (walletId: string) => {
    // This will be implemented with the blockchain API
    try {
      const response = await supabase.functions.invoke('sync-wallet-balance', {
        body: { walletId }
      });
      
      if (response.error) throw response.error;
      
      await fetchWallets();
      toast({
        title: "Success",
        description: "Wallet balance synced",
      });
    } catch (error) {
      console.error('Error syncing wallet:', error);
      toast({
        title: "Error",
        description: "Failed to sync wallet balance",
        variant: "destructive",
      });
    }
  };

  return {
    wallets,
    loading,
    connectWallet,
    syncWalletBalance,
    fetchWallets
  };
}
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from 'wagmi';
import { DEFAULT_CHAIN } from '@/config/wagmi';

type SyncParams = {
  walletAddress: string;
  chainIds: number[];
  since?: string;
  cursor?: string | null;
};

// Minimal wallet info for dashboard metrics
type WalletInfo = {
  address: `0x${string}`;
  chainId: number;
  balance_usd?: number;
  verification_status?: 'verified' | 'unverified';
};

export function useWallet() {
  const { address: activeAddress, chainId: activeChainId } = useAccount();

const activeWallet = useMemo(() => {
    if (!activeAddress) return null;
    return { address: activeAddress, chainId: activeChainId ?? DEFAULT_CHAIN.id };
  }, [activeAddress, activeChainId]);

  const wallets: WalletInfo[] = useMemo(() => {
    return activeWallet
      ? [{ address: activeWallet.address as `0x${string}`, chainId: activeWallet.chainId }]
      : [];
  }, [activeWallet]);

  const syncWalletTransactions = async (params: SyncParams) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { data, error } = await supabase.functions.invoke('sync-wallet-transactions', {
      body: { userId, ...params },
    });
    if (error) throw error;
    return data;
  };

const syncAllWallets = async () => {
    if (!activeWallet) return;
    await syncWalletTransactions({
      walletAddress: activeWallet.address,
      chainIds: [DEFAULT_CHAIN.id],
      cursor: null,
    });
  };

// Minimal connectWallet to satisfy UI typing without altering behavior
  const connectWallet = async (
    _address: string,
    _walletType?: string,
    _walletName?: string
  ): Promise<boolean> => {
    throw new Error('connectWallet not implemented');
  };

  return { activeWallet, wallets, syncWalletTransactions, syncAllWallets, connectWallet };
}

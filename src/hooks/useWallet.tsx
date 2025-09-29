import { useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAccount } from 'wagmi';
import { DEFAULT_CHAIN } from '@/config/wagmi';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

type SyncParams = {
  walletAddress: string;
  chainIds: number[];
  since?: string;
  cursor?: string | null;
};

export function useWallet() {
  const { address: activeAddress, chainId: activeChainId } = useAccount();

  const activeWallet = useMemo(() => {
    if (!activeAddress) return null;
    return { address: activeAddress, chainId: activeChainId ?? DEFAULT_CHAIN.id };
  }, [activeAddress, activeChainId]);

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
      chainIds: [DEFAULT_CHAIN.id], // Polygonのみ
      cursor: null,
    });
  };

  return { activeWallet, syncWalletTransactions, syncAllWallets };
}

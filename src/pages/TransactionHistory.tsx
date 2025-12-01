// src/pages/Transactions.tsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { RefreshCw } from 'lucide-react'

function SyncHub() {
  const { session } = useAuth()
  const { toast } = useToast()
  const [wallets, setWallets] = useState<{ wallet_address: string, wallet_name: string | null, chain: string }[]>([])
  const [exchanges, setExchanges] = useState<{ exchange: string }[]>([])
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  async function fetchConnections() {
    if (!session) return;
    const { data: walletData } = await supabase.from('wallet_connections').select('wallet_address, wallet_name, chain').eq('user_id', session.user.id);
    setWallets(walletData || []);
    // (exchangeのfetchは省略)
  }

  useEffect(() => { fetchConnections() }, [session])

  const handleSync = async (type: 'wallet' | 'exchange', identifier: string, chain?: string) => {
    if (!session) return;
    const id = `${type}-${identifier}-${chain || ''}`;
    setLoading(prev => ({ ...prev, [id]: true }));
    
    try {
      const functionName = 'sync-wallet-transactions'; // wallet syncに限定
      if (type !== 'wallet' || !chain) throw new Error("Invalid sync type or missing chain.");

      toast({ title: `Sync started for ${identifier} on ${chain}...` });

      const { data, error } = await supabase.functions.invoke(functionName, { body: { walletAddress: identifier, chain: chain } });

      if (error) throw new Error(error.message);
      
      // [修正点] バックエンドからのメッセージを直接表示
      const message = data.message || `Sync finished with unclear results.`;
      const count = data.count ?? 0;

      toast({
        title: `Sync Complete for ${identifier}`,
        description: message,
      });

      // [修正点] 新しいデータが保存された場合のみリロード
      if (count > 0) {
        window.location.reload();
      }

    } catch (e: any) {
      toast({ variant: 'destructive', title: `Sync Failed for ${identifier}`, description: e.message });
      console.error(`Sync error for ${id}:`, e);
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }));
    }
  }

  if (wallets.length === 0 && exchanges.length === 0) {
      return <Alert><AlertTitle>No Connections Found</AlertTitle></Alert>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Sync</CardTitle>
        <CardDescription>Click to sync the latest transaction history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {wallets.map(w => (
          <div key={w.wallet_address + w.chain} className="flex items-center justify-between p-2 border rounded-md">
            <span>Wallet: {w.wallet_name || w.wallet_address} ({w.chain})</span>
            <Button size="sm" onClick={() => handleSync('wallet', w.wallet_address, w.chain)} disabled={loading[`wallet-${w.wallet_address}-${w.chain}`]}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading[`wallet-${w.wallet_address}-${w.chain}`] ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ... 以降のTransactionsTable, TransactionsPageは変更なし
function TransactionsTable() { return (<Card><CardHeader><CardTitle>All Transactions</CardTitle></CardHeader><CardContent><p>Transaction list will be displayed here.</p></CardContent></Card>) }
export function TransactionsPage() { return (<div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6"><h1 className="text-3xl font-bold tracking-tight">Transactions</h1><SyncHub /><TransactionsTable /></div>) }
export default TransactionsPage;

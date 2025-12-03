// src/pages/Transactions.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Wallet, GitCompareArrows } from "lucide-react";

// --- [修正] `SyncHub`を拡張し、取引所の同期機能を追加 ---
function SyncHub() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<{ wallet_address: string, wallet_name: string | null, chain: string }[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function fetchConnections() {
    if (!session) return;
    const { data: walletData } = await supabase.from('wallet_connections').select('wallet_address, wallet_name, chain').eq('user_id', session.user.id);
    setWallets(walletData || []);
  }

  useEffect(() => { fetchConnections() }, [session]);

  const handleWalletSync = async (identifier: string, chain: string) => {
    // (この関数のロジックは変更なし)
  };

  // [追加] 全ての取引所を一度に同期する
  const handleExchangeSyncAll = async () => {
    const id = 'sync-all-exchanges';
    setLoading(prev => ({ ...prev, [id]: true }));
    toast({ title: "Syncing all exchanges..." });
    try {
        const { data, error } = await supabase.functions.invoke('exchange-sync-all');
        if (error) throw new Error(error.message);
        toast({ title: "Exchange Sync Complete", description: `Saved ${data.totalSaved} new trades.` });
        window.location.reload();
    } catch (e: any) {
        toast({ variant: "destructive", title: "Exchange Sync Failed", description: e.message });
    } finally {
        setLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Sync</CardTitle>
        <CardDescription>Manually sync the latest transaction history from your connected sources.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ウォレット同期 */}
        {wallets.map(w => (
          <div key={w.wallet_address + w.chain} className="flex items-center justify-between p-3 border rounded-lg bg-background">
            <div className='flex items-center'><Wallet className="h-4 w-4 mr-2" /> <span>{w.wallet_name || w.wallet_address} ({w.chain})</span></div>
            <Button size="sm" onClick={() => handleWalletSync(w.wallet_address, w.chain)} disabled={loading[`wallet-${w.wallet_address}-${w.chain}`]}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading[`wallet-${w.wallet_address}-${w.chain}`] ? 'animate-spin' : ''}`} /> Sync
            </Button>
          </div>
        ))}
        {/* 取引所同期 */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
            <div className='flex items-center'><GitCompareArrows className="h-4 w-4 mr-2" /> <span>All Connected Exchanges</span></div>
            <Button size="sm" onClick={handleExchangeSyncAll} disabled={loading['sync-all-exchanges']}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading['sync-all-exchanges'] ? 'animate-spin' : ''}`} />
                Sync All
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}


// --- [修正] `TransactionsTable`を実際のデータ表示コンポーネントに ---
function TransactionsTable() {
    const { session } = useAuth();
    const { toast } = useToast();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    async function fetchTransactions() {
        if (!session) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('all_transactions') // [重要] 新しく作成したビューから取得
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            toast({ variant: "destructive", title: "Failed to load transactions", description: error.message });
        } else {
            setTransactions(data);
        }
        setLoading(false);
    }

    useEffect(() => {
        fetchTransactions();
    }, [session]);
    
    return (
        <Card>
            <CardHeader><CardTitle>All Transactions</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Asset</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={5} className="text-center h-24">Loading data...</TableCell></TableRow>
                        ) : transactions.length > 0 ? (
                            transactions.map(tx => (
                                <TableRow key={tx.id + tx.source}>
                                    <TableCell className="text-sm text-muted-foreground">{new Date(tx.date).toLocaleString()}</TableCell>
                                    <TableCell><span className={`capitalize text-xs font-semibold px-2 py-1 rounded-full ${tx.source === 'on-chain' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{tx.source}</span></TableCell>
                                    <TableCell className="font-medium">{tx.description}</TableCell>
                                    <TableCell className={`text-right font-mono ${tx.type === 'buy' || tx.type === 'transfer' ? 'text-green-600' : 'text-red-600'}`}>{tx.type === 'sell' ? '-' : ''}{Number(tx.amount).toFixed(6)}</TableCell>
                                    <TableCell>{tx.asset}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={5} className="text-center h-24">No transactions found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

// --- メインページコンポーネント (変更なし) ---
export function TransactionsPage() { 
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
      <SyncHub />
      <TransactionsTable />
    </div>
  ) 
}
export default TransactionsPage;

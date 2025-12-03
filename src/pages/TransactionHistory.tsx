// src/pages/TransactionHistory.tsx

"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Wallet, GitCompareArrows } from "lucide-react";

// --- 同期機能ハブ ---
function SyncHub({ onSyncComplete }: { onSyncComplete: () => void }) {
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
    const id = `wallet-${identifier}-${chain}`;
    setLoading(prev => ({ ...prev, [id]: true }));
    toast({ title: `Sync started for wallet ${identifier}...` });
    try {
        const { data, error } = await supabase.functions.invoke('sync-wallet-transactions', { body: { walletAddress: identifier, chain: chain } });
        if (error) throw new Error(error.message);
        toast({ title: `Wallet Sync Complete`, description: data.message });
        if (data.count > 0) onSyncComplete();
    } catch (e: any) {
        toast({ variant: "destructive", title: "Wallet Sync Failed", description: e.message });
    } finally {
        setLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleExchangeSyncAll = async () => {
    const id = 'sync-all-exchanges';
    setLoading(prev => ({ ...prev, [id]: true }));
    toast({ title: "Syncing all exchanges..." });

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Authentication session not found.");
      
      const accessToken = session.access_token;
      // VITE_SUPABASE_URLを環境変数から取得
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/exchange-sync-all`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || `Server responded with status ${response.status}`);

      toast({ title: "Exchange Sync Complete", description: `Saved ${responseData.totalSaved} new trades.` });
      if (responseData.totalSaved > 0) onSyncComplete();

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
        {wallets.map(w => (
          <div key={w.wallet_address + w.chain} className="flex items-center justify-between p-3 border rounded-lg bg-background">
            <div className='flex items-center'><Wallet className="h-4 w-4 mr-2" /> <span>{w.wallet_name || w.wallet_address} ({w.chain})</span></div>
            <Button size="sm" onClick={() => handleWalletSync(w.wallet_address, w.chain)} disabled={loading[`wallet-${w.wallet_address}-${w.chain}`]}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading[`wallet-${w.wallet_address}-${w.chain}`] ? 'animate-spin' : ''}`} /> Sync
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
            <div className='flex items-center'><GitCompareArrows className="h-4 w-4 mr-2" /> <span>All Connected Exchanges</span></div>
            <Button size="sm" onClick={handleExchangeSyncAll} disabled={loading['sync-all-exchanges']}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading['sync-all-exchanges'] ? 'animate-spin' : ''}`} /> Sync All
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- 全取引テーブル ---
function TransactionsTable({ refreshKey }: { refreshKey: number }) {
    const { session } = useAuth();
    const { toast } = useToast();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    async function fetchTransactions() {
        if (!session) return;
        setLoading(true);
        const { data, error } = await supabase.from('all_transactions').select('*').order('date', { ascending: false });
        if (error) {
            toast({ variant: "destructive", title: "Failed to load transactions", description: error.message });
        } else {
            setTransactions(data);
        }
        setLoading(false);
    }

    useEffect(() => { fetchTransactions(); }, [session, refreshKey]);
    
    return (
        <Card>
            <CardHeader><CardTitle>All Transactions</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead> <TableHead>Source</TableHead> <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead> <TableHead>Asset</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (<TableRow><TableCell colSpan={5} className="text-center h-24">Loading data...</TableCell></TableRow>) 
                        : transactions.length > 0 ? (transactions.map(tx => (
                            <TableRow key={`${tx.id}-${tx.source}`}>
                                <TableCell className="text-sm text-muted-foreground">{new Date(tx.date).toLocaleString()}</TableCell>
                                <TableCell><span className={`capitalize text-xs font-semibold px-2 py-1 rounded-full ${tx.source === 'on-chain' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{tx.source}</span></TableCell>
                                <TableCell className="font-medium">{tx.description}</TableCell>
                                <TableCell className={`text-right font-mono ${tx.type === 'buy' || tx.type === 'deposit' || tx.type === 'receive' ? 'text-green-600' : 'text-red-600'}`}>{tx.type === 'sell' || tx.type === 'withdrawal' || tx.type === 'send' ? '-' : ''}{Number(tx.amount).toFixed(6)}</TableCell>
                                <TableCell>{tx.asset}</TableCell>
                            </TableRow>
                        ))) : (<TableRow><TableCell colSpan={5} className="text-center h-24">No transactions found.</TableCell></TableRow>)}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

// --- メインページ ---
export function TransactionHistoryPage() { 
  const [refreshKey, setRefreshKey] = useState(0);
  const handleSyncComplete = () => setRefreshKey(prevKey => prevKey + 1);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
      <SyncHub onSyncComplete={handleSyncComplete} />
      <TransactionsTable refreshKey={refreshKey} />
    </div>
  ) 
}
export default TransactionHistoryPage;

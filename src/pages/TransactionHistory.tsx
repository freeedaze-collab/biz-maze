// src/pages/Transactions.tsx

"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Wallet, GitCompareArrows } from "lucide-react";

// --- SyncHub (最終決戦仕様) ---
function SyncHub({ onSyncComplete }: { onSyncComplete: () => void }) {
  const { session } = useAuth();
  const { toast } = useToast();
  // (他のstateやuseEffectは変更なし)
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  useEffect(() => { /* ... */ }, [session]);
  const handleWalletSync = async (identifier: string, chain: string) => { /* ... */ };

  // [最重要修正] supabase.functions.invoke を捨て、プレーンな fetch に置き換える
  const handleExchangeSyncAll = async () => {
    const id = 'sync-all-exchanges';
    console.log('[CLIENT] Using plain fetch to call exchange-sync-all...');
    setLoading(prev => ({ ...prev, [id]: true }));
    toast({ title: "Syncing all exchanges..." });

    try {
      // 1. 必要な情報を手動で取得
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Authentication session not found.");
      
      const accessToken = session.access_token;
      const functionUrl = `${Deno.env.VITE_SUPABASE_URL}/functions/v1/exchange-sync-all`;

      // 2. fetch API を使って直接リクエストを送信
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': Deno.env.VITE_SUPABASE_ANON_KEY!,
        },
      });

      console.log('[CLIENT] fetch response received. Status:', response.status);

      // 3. レスポンスをJSONとして手動で解析
      const responseData = await response.json();
      console.log('[CLIENT] fetch response data:', responseData);

      if (!response.ok) {
        // サーバーがエラーを返した場合
        throw new Error(responseData.error || `Server responded with status ${response.status}`);
      }

      // 4. 成功をトーストで通知
      toast({
        title: "Function Response Received!",
        description: `Message: ${responseData.message}`,
        variant: 'default',
        duration: 9000,
      });

      if (responseData && typeof responseData.totalSaved === 'number' && responseData.totalSaved > 0) {
        onSyncComplete();
      }

    } catch (e: any) {
      console.error('[CLIENT] CRASH! Caught in top-level catch block:', e);
      toast({
        variant: "destructive",
        title: "[CLIENT] Exchange Sync CRASHED",
        description: e.message,
      });
    } finally {
      console.log('[CLIENT] Reached finally block.');
      setLoading(prev => ({ ...prev, [id]: false }));
    }
  };
  
  // (return文は変更なし)
  return ( <Card> ... </Card> );
}

// (TransactionsTable と TransactionsPage は変更なし)
function TransactionsTable({ refreshKey }: { refreshKey: number }) { /* ... */ }
export function TransactionsPage() { /* ... */ }
export default TransactionsPage;

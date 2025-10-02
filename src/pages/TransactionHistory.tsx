// src/pages/TransactionHistory.tsx
import { useEffect, useMemo, useState } from "react";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw, History } from "lucide-react";

type Tx = {
  id: string;
  user_id: string;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
  [k: string]: any;
};

export default function TransactionHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Tx[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // RLS: auth.uid() = user_id で見えるデータのみ
      const { data, error, status } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user?.id ?? "")
        .order("created_at", { ascending: false });

      if (error) {
        // 400/その他を考慮して安全に処理
        console.error("[transactions] fetch error:", status, error.message);
        setErrorMsg(error.message);
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
    } catch (e: any) {
      console.error("[transactions] exception:", e?.message ?? e);
      setErrorMsg(e?.message ?? "Unknown error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      // 未ログインの瞬間は空で表示
      setRows([]);
      setLoading(false);
      return;
    }
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.amount ?? 0) || 0), 0),
    [rows]
  );

  const handleResync = async () => {
    // （任意）同期エンドポイントを叩く場合はここで fetch する
    // 例: await fetch('/functions/v1/sync-wallet-transactions', { headers: { Authorization: `Bearer ${session?.access_token}` }});
    await fetchRows();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <History className="h-6 w-6" />
            <div>
              <h1 className="text-2xl font-bold">Transaction History</h1>
              <p className="text-muted-foreground">Your recent activity</p>
            </div>
          </div>
          <Navigation />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                {loading ? "Loading..." : `${rows.length} item(s), Total: ${total}`}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleResync}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Resync
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : errorMsg ? (
              <p className="text-destructive">Error: {errorMsg}</p>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No transactions yet. Total: 0
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tx.created_at ?? "-"}</span>
                      <span className="text-muted-foreground">/</span>
                      <span>{tx.status ?? "-"}</span>
                    </div>
                    <div className="tabular-nums">{Number(tx.amount ?? 0)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

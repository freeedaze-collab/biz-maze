// src/pages/exchange/VCE.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ExchangeConn = {
  id: number;
  user_id: string;
  exchange: string;
  external_user_id?: string | null;
  created_at?: string | null;
  status?: string | null;
};

export default function VCE() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExchangeConn[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("exchange_connections")
      .select("id,user_id,exchange,external_user_id,created_at,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[vce] load error:", error);
      setRows([]);
    } else {
      setRows((data as ExchangeConn[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Virtual Custody / Exchanges</h1>
        <Link to="/dashboard" className="text-sm underline">
          Back to Dashboard
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        Connect your centralized exchanges (e.g., Binance, Bybit, OKX) to sync trades,
        deposits/withdrawals, and balances. (Early preview)
      </p>

      {/* Connect buttons（実装の土台。後でOAuth/APIキー接続へ差し替え） */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold mb-1">Add connection</div>
        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 rounded border"
            onClick={() => alert("Binance connector coming soon")}
          >
            Connect Binance
          </button>
          <button
            className="px-3 py-2 rounded border"
            onClick={() => alert("Bybit connector coming soon")}
          >
            Connect Bybit
          </button>
          <button
            className="px-3 py-2 rounded border"
            onClick={() => alert("OKX connector coming soon")}
          >
            Connect OKX
          </button>
        </div>
      </div>

      {/* 一覧 */}
      <div className="border rounded-xl p-4">
        <div className="font-semibold mb-2">Your connections</div>
        {loading ? (
          <div>Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No connections yet.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="border rounded p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{r.exchange}</div>
                    <div className="text-xs text-muted-foreground">
                      ext_user: {r.external_user_id ?? "—"} • {r.created_at ?? "—"} •{" "}
                      {r.status ?? "active"}
                    </div>
                  </div>
                  <button
                    className="px-3 py-1.5 rounded border text-xs"
                    onClick={() => alert("Sync coming soon")}
                  >
                    Sync now
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

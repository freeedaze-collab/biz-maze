// src/pages/exchange/VCE.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Exchange = "binance" | "bybit" | "okx";

type ExchangeConn = {
  id: number;
  user_id: string;
  exchange: string;
  external_user_id?: string | null;
  created_at?: string | null;
  status?: string | null;
};

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exchange-binance-proxy`;

export default function VCE() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExchangeConn[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<Exchange | null>(null);

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

  const linkExchange = async (exchange: Exchange) => {
    try {
      if (!user?.id) {
        alert("Please login again.");
        return;
      }
      setLinking(exchange);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error("No session");

      const res = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "link", exchange }), // ← ここだけ変えれば各社OK
      });

      const text = await res.text();
      let body: any = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }

      if (!res.ok || body?.ok === false) {
        throw new Error(
          typeof body === "string" ? body : body?.error || `Link failed (${res.status})`
        );
      }

      await load();
      alert(`Linked ${exchange} ✔`);
    } catch (e: any) {
      console.error("[vce] link error:", e);
      alert(e?.message ?? String(e));
    } finally {
      setLinking(null);
    }
  };

  const label = (ex: Exchange) =>
    ex === "binance" ? "Binance" : ex === "bybit" ? "Bybit" : "OKX";

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

      {/* Connect buttons */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="font-semibold mb-1">Add connection</div>
        <div className="flex flex-wrap gap-2">
          {(["binance", "bybit", "okx"] as Exchange[]).map((ex) => (
            <button
              key={ex}
              className="px-3 py-2 rounded border disabled:opacity-50"
              onClick={() => linkExchange(ex)}
              disabled={!!linking}
              title={`Connect ${label(ex)}`}
            >
              {linking === ex ? `Connecting ${label(ex)}...` : `Connect ${label(ex)}`}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          For now, linking just registers the connection in your account. API key / OAuth
          screens will come next; you can still add multiple exchanges today.
        </p>
      </div>

      {/* Connections list */}
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
                    <div className="font-medium">{r.exchange.toUpperCase()}</div>
                    <div className="text-xs text-muted-foreground">
                      ext_user: {r.external_user_id ?? "—"} • {r.created_at ?? "—"} •{" "}
                      {r.status ?? "linked"}
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

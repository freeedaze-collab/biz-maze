// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAccount, useBalance } from "wagmi";

type WalletRow = {
  id: number;
  user_id: string;
  address: string;
  network?: string | null;
  created_at?: string | null;
  verified?: boolean | null;
};

export default function WalletSelection() {
  const { user } = useAuth();
  const { address: connected } = useAccount();
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  const short = useMemo(() => {
    if (!connected) return "-";
    return `${connected.slice(0, 6)}...${connected.slice(-4)}`;
  }, [connected]);

  const { data: balanceData } = useBalance({
    address: connected as `0x${string}` | undefined,
    query: { enabled: !!connected },
  });

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("wallets")
      .select("id,user_id,address,network,created_at,verified")
      .eq("user_id", user.id) // ← フロントでも念のため絞る
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[wallets] load error:", error);
      setRows([]);
    } else {
      setRows((data as WalletRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const linkWallet = async () => {
    if (!user?.id || !connected) return;
    setLinking(true);
    try {
      // 1) ノンス取得
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-wallet-signature`;
      const resGet = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resGet.ok) throw new Error(await resGet.text());
      const { nonce } = await resGet.json();

      // 2) SIWE署名
      // wagmi v2: signMessageAsync は任意の場所のユーティリティ。ここでは window.ethereum 経由の標準ダイアログを使う簡易版。
      const signature = await (window as any).ethereum.request({
        method: "personal_sign",
        params: [nonce, connected],
      });

      // 3) 検証
      const resPost = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: connected, signature, nonce }),
      });
      if (!resPost.ok) {
        const t = await resPost.text();
        throw new Error(t);
      }

      // 4) 成功後リロード
      await load();
    } catch (e: any) {
      console.error("[wallets] linkWallet error:", e?.message ?? e);
      alert(`Link failed: ${e?.message ?? e}`);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wallet Creation / Linking</h1>

      <div className="text-sm">
        Tip: After clicking “Verify &amp; Link”, MetaMask will open a signature window. Sign to prove ownership.
      </div>

      <div className="border rounded-xl p-4 space-y-1">
        <div className="font-semibold">MetaMask</div>
        <div className="text-sm text-muted-foreground">
          {connected ? "Connected" : "Not connected"}
        </div>
        <div className="mt-2 text-sm">Account</div>
        <div className="font-mono break-all">{connected ?? "-"}</div>
        <div className="text-sm mt-2">Short</div>
        <div>{short}</div>
        <div className="text-sm mt-2">Balance</div>
        <div>{balanceData ? balanceData.formatted + " " + balanceData.symbol : "-"}</div>

        <button
          disabled={!connected || linking}
          onClick={linkWallet}
          className="mt-4 px-3 py-2 rounded bg-blue-600 text-white"
        >
          {linking ? "Linking..." : "Link Wallet"}
        </button>
      </div>

      <div className="border rounded-xl p-4">
        <div className="font-semibold mb-2">Your Linked Wallets</div>
        {loading ? (
          <div>Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No linked wallets yet.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((w) => (
              <li key={w.id} className="border rounded p-3">
                <div className="font-mono break-all">{w.address}</div>
                <div className="text-xs text-muted-foreground">
                  {w.network ?? "—"} • {w.verified ? "verified" : "unverified"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

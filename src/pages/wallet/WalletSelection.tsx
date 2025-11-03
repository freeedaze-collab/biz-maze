// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "wagmi";

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

  // 画面上には出さないが、署名にだけ使うため取得
  const { address: connected } = useAccount();

  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  // 接続中アドレスが既にDBに存在するか（重複防止）
  const isConnectedAddressLinked = useMemo(() => {
    if (!connected) return false;
    return rows.some((r) => r.address?.toLowerCase() === connected.toLowerCase());
  }, [rows, connected]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("wallets")
      .select("id,user_id,address,network,created_at,verified")
      .eq("user_id", user.id) // 本人のみ
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

  const linkCurrentWallet = async () => {
    if (!user?.id) return;

    try {
      // MetaMask 接続を要求（未接続の場合）
      if (!(window as any).ethereum) {
        alert("Please install MetaMask.");
        return;
      }
      const accounts: string[] = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      const addr = accounts?.[0];
      if (!addr) {
        alert("No wallet account connected.");
        return;
      }

      // 既にリンク済みならスキップ
      if (rows.some((r) => r.address?.toLowerCase() === addr.toLowerCase())) {
        alert("This wallet is already linked to your account.");
        return;
      }

      setLinking(true);

      // 1) ノンス取得（認証必須）
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-wallet-signature`;

      const resGet = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resGet.ok) throw new Error(await resGet.text());
      const { nonce } = await resGet.json();

      // 2) 署名（personal_sign）
      const signature = await (window as any).ethereum.request({
        method: "personal_sign",
        params: [nonce, addr],
      });

      // 3) 検証（サーバで recover → DB upsert）
      const resPost = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: addr, signature, nonce }),
      });
      if (!resPost.ok) throw new Error(await resPost.text());

      await load();
    } catch (e: any) {
      console.error("[wallets] linkCurrentWallet error:", e?.message ?? e);
      alert(`Link failed: ${e?.message ?? e}`);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wallets</h1>
      <p className="text-sm text-muted-foreground">
        このページは <strong>あなたのアカウントに連携済みのウォレット</strong> だけを表示します。
        新規追加時のみ署名ウィンドウが開き、本人性を検証します。
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={linkCurrentWallet}
          disabled={linking}
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {linking ? "Linking..." : "Link current wallet"}
        </button>
        <span className="text-xs text-muted-foreground">
          ※ ボタンを押すと署名画面が開き、検証に成功すると一覧へ追加されます。
        </span>
      </div>

      <div className="border rounded-xl p-4">
        <div className="font-semibold mb-2">Linked wallets (DB)</div>
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

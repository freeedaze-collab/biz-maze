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

  // 接続中アドレスが DB に既に存在するか
  const isConnectedAddressLinked = useMemo(() => {
    if (!connected) return false;
    return rows.some((r) => r.address?.toLowerCase() === connected.toLowerCase());
  }, [rows, connected]);

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
      .eq("user_id", user.id) // ← 本人のみ
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
    if (isConnectedAddressLinked) return;

    setLinking(true);
    try {
      // 1) ノンス取得（要 Authorization）
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-wallet-signature`;

      const resGet = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resGet.ok) throw new Error(await resGet.text());
      const { nonce } = await resGet.json();

      // 2) 署名（EIP-191 / personal_sign）
      // wagmi の signMessageAsync を使ってもOK。ここでは簡易に window.ethereum を利用。
      const signature = await (window as any).ethereum.request({
        method: "personal_sign",
        params: [nonce, connected],
      });

      // 3) 検証 → サーバ側で DB upsert
      const resPost = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: connected, signature, nonce }),
      });
      if (!resPost.ok) throw new Error(await resPost.text());

      await load();
    } catch (e: any) {
      console.error("[wallets] linkWallet error:", e?.message ?? e);
      alert(`Link failed: ${e?.message ?? e}`);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Wallet Creation / Linking</h1>
        <p className="text-sm text-muted-foreground mt-2">
          <strong>上段</strong>は「ブラウザに接続中のウォレット（表示のみ）」、<strong>下段</strong>は「あなたのアカウントに
          連携済み（DB）のウォレット一覧」です。
        </p>
      </header>

      {/* 接続中ウォレット（表示用・DBとは別もの） */}
      <section className="border rounded-xl p-4 space-y-2">
        <div className="font-semibold">Currently Connected (not linked by default)</div>
        <div className="text-sm text-muted-foreground">
          {connected ? "MetaMask: Connected" : "MetaMask: Not connected"}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Account</div>
          <div className="font-mono break-all">{connected ?? "-"}</div>

          <div className="text-muted-foreground">Short</div>
          <div>{short}</div>

          <div className="text-muted-foreground">Balance</div>
          <div>{balanceData ? `${balanceData.formatted} ${balanceData.symbol}` : "-"}</div>
        </div>

        <div className="pt-2">
          {isConnectedAddressLinked ? (
            <span className="inline-flex items-center gap-2 text-green-700">
              <span className="h-2 w-2 rounded-full bg-green-600" />
              This connected address is <b>already linked</b> to your account.
            </span>
          ) : (
            <button
              disabled={!connected || linking}
              onClick={linkWallet}
              className="mt-2 px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            >
              {linking ? "Linking..." : "Verify & Link this wallet"}
            </button>
          )}
        </div>
      </section>

      {/* 連携済みウォレット（DBの一覧） */}
      <section className="border rounded-xl p-4">
        <div className="font-semibold mb-2">Your Linked Wallets (from DB)</div>
        {loading ? (
          <div>Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No linked wallets yet.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((w) => {
              const isThis = connected && w.address?.toLowerCase() === connected.toLowerCase();
              return (
                <li key={w.id} className="border rounded p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono break-all">{w.address}</div>
                      <div className="text-xs text-muted-foreground">
                        {w.network ?? "—"} • {w.verified ? "verified" : "unverified"}
                      </div>
                    </div>
                    {isThis && (
                      <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                        connected now
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

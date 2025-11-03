// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "wagmi";
import { isAddress } from "viem";

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
  const { address: connected } = useAccount(); // 署名のためだけに使用（UIには出さない）

  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  const [addressInput, setAddressInput] = useState("");

  const normalizedInput = useMemo(
    () => addressInput?.trim(),
    [addressInput]
  );

  const alreadyLinked = useMemo(() => {
    if (!normalizedInput) return false;
    return rows.some((r) => r.address.toLowerCase() === normalizedInput.toLowerCase());
  }, [rows, normalizedInput]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("wallets")
      .select("id,user_id,address,network,created_at,verified")
      .eq("user_id", user.id)
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

  const handleLink = async () => {
    // 1) 入力検証
    if (!user?.id) {
      alert("Please login again.");
      return;
    }
    if (!normalizedInput) {
      alert("Please input your wallet address.");
      return;
    }
    if (!isAddress(normalizedInput)) {
      alert("Invalid Ethereum address format.");
      return;
    }
    if (alreadyLinked) {
      alert("This wallet is already linked to your account.");
      return;
    }

    // 2) MetaMask/接続アカウントの取得
    if (!(window as any).ethereum) {
      alert("Please install MetaMask.");
      return;
    }
    // 必要ならアカウント接続
    const accounts: string[] = await (window as any).ethereum.request({
      method: "eth_requestAccounts",
    });
    const current = accounts?.[0];
    if (!current) {
      alert("No wallet account connected.");
      return;
    }
    // 入力アドレスと接続アカウントの一致を強制（本人性担保）
    if (current.toLowerCase() !== normalizedInput.toLowerCase()) {
      // 可能なら切り替えを促す
      try {
        await (window as any).ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (_) {
        // noop
      }
      alert(
        "The connected MetaMask account is different from the input address.\n" +
          "Please switch MetaMask to the input address and try again."
      );
      return;
    }

    setLinking(true);
    try {
      // 3) ノンス取得
      const { data: nonceData, error: nonceErr } = await supabase.functions.invoke('verify-wallet-signature', {
        body: { action: 'nonce' },
      });
      if (nonceErr) throw new Error(nonceErr.message);
      const nonce = nonceData?.nonce;
      if (!nonce) throw new Error("Failed to get nonce");

      // 4) 署名（EIP-191 personal_sign）
      const signature = await (window as any).ethereum.request({
        method: "personal_sign",
        params: [nonce, current],
      });

      // 5) 検証→DB登録（Edge Function側で recover & upsert）
      const { data: verifyData, error: verifyErr } = await supabase.functions.invoke('verify-wallet-signature', {
        body: {
          action: 'verify',
          address: normalizedInput,
          signature,
          nonce,
        },
      });
      if (verifyErr) throw new Error(verifyErr.message);
      if (!verifyData?.ok) throw new Error("Verification failed");

      // 6) 完了
      setAddressInput("");
      await load();
      alert("Wallet has been linked successfully.");
    } catch (e: any) {
      console.error("[wallets] link error:", e?.message ?? e);
      alert(`Link failed: ${e?.message ?? e}`);
    } finally {
      setLinking(false);
    }
  };

  const fillFromConnected = async () => {
    if (!(window as any).ethereum) return;
    const accounts: string[] = await (window as any).ethereum.request({
      method: "eth_requestAccounts",
    });
    const current = accounts?.[0];
    if (current) setAddressInput(current);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wallets</h1>
      <p className="text-sm text-muted-foreground">
        このページには<strong>あなたのアカウントに連携済みのウォレット</strong>のみ表示されます。
        新しいウォレットを連携するにはアドレスを入力後、署名で本人性を確認します。
      </p>

      {/* 入力 → 署名 → 完了 */}
      <div className="border rounded-xl p-4 space-y-3">
        <label className="text-sm font-medium">Wallet Address</label>
        <div className="flex items-center gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder="0x..."
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="px-3 py-2 rounded border"
            onClick={fillFromConnected}
            title="Use current MetaMask account"
          >
            Use connected
          </button>
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={handleLink}
            disabled={linking}
          >
            {linking ? "Linking..." : "Link Wallet"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          ※ MetaMaskで<strong>入力したアドレスと同じアカウント</strong>に切り替えた上で署名してください。
        </p>
        {alreadyLinked && (
          <p className="text-xs text-green-700">This address is already linked.</p>
        )}
      </div>

      {/* 連携済み一覧（DB） */}
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

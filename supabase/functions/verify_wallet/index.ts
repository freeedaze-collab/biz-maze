// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isAddress } from "viem";

type WalletRow = {
  id: number;
  user_id: string;
  address: string;
  created_at?: string | null;
  verified?: boolean | null;
};

export default function WalletSelection() {
  const { user } = useAuth();

  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [addressInput, setAddressInput] = useState("");

  const normalizedInput = useMemo(() => addressInput.trim(), [addressInput]);

  const alreadyLinked = useMemo(() => {
    if (!normalizedInput) return false;
    return rows.some(
      (r) => r.address?.toLowerCase() === normalizedInput.toLowerCase()
    );
  }, [rows, normalizedInput]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("wallets")
      .select("id,user_id,address,created_at,verified")
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

  // —— 署名 & 検証 & 登録 ——
  const handleLink = async () => {
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

    // 1) セッションJWT（必要なら送る。CORSとは無関係）
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token ?? undefined;

    // 2) MetaMask の現在アカウントを取得し、入力と一致を強制
    if (!(window as any).ethereum) {
      alert("MetaMask not found. Please install/enable it.");
      return;
    }

    let selected: string | undefined;
    try {
      const accounts: string[] = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      selected = accounts?.[0];
    } catch (e: any) {
      console.error("[wallets] eth_requestAccounts error:", e);
      alert(`Failed to access MetaMask accounts: ${e?.message ?? e}`);
      return;
    }
    if (!selected) {
      alert("No MetaMask account connected.");
      return;
    }

    // ★ ここで厳密一致を要求（大小文字は無視）
    if (selected.toLowerCase() !== normalizedInput.toLowerCase()) {
      alert(
        [
          "The MetaMask selected account is different from the input address.",
          `Selected: ${selected}`,
          `Input   : ${normalizedInput}`,
          "",
          "Please switch MetaMask to the input address and try again.",
        ].join("\n")
      );
      return;
    }

    setLinking(true);
    try {
      // 3) ノンス取得（GET）
      const FN =
        "https://ymddtgbsybvxfitgupqy.functions.supabase.co/functions/v1/verify-wallet-signature";

      const nonceRes = await fetch(FN, {
        method: "GET",
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : undefined,
      });
      if (!nonceRes.ok) {
        const txt = await nonceRes.text().catch(() => "");
        throw new Error(`Nonce fetch failed: ${nonceRes.status} ${txt}`);
      }
      const { nonce } = await nonceRes.json();
      if (!nonce) throw new Error("Nonce missing from response.");

      // 4) 署名（EIP-191 personal_sign）: [message, signerAddress]
      const signature: string = await (window as any).ethereum.request({
        method: "personal_sign",
        params: [nonce, selected],
      });

      // 5) 検証（POST）
      const verifyRes = await fetch(FN, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          address: normalizedInput, // ← 入力＝現在選択アカウントであることを事前に保証済み
          signature,
          nonce,
        }),
      });

      const bodyTxt = await verifyRes.text();
      console.log("[verify] status/body:", verifyRes.status, bodyTxt);

      if (!verifyRes.ok) {
        // サーバは mismatch 時に {error, recovered, address} を返す実装
        throw new Error(bodyTxt || `Verify failed: ${verifyRes.status}`);
      }

      // 成功 → 再読込
      setAddressInput("");
      await load();
      alert("Wallet has been linked successfully.");
    } catch (e: any) {
      console.error("[wallets] link error:", e);
      alert(`Link failed: ${e?.message ?? e}`);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wallets</h1>
      <p className="text-sm text-muted-foreground">
        あなたのアカウントに紐づくウォレットのみ表示されます。新規連携は
        <strong>アドレス入力→署名→完了</strong> の順です。
      </p>

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
            className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={handleLink}
            disabled={linking}
          >
            {linking ? "Linking..." : "Link Wallet"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          MetaMask で<strong>入力アドレスと同じアカウント</strong>を選択してから実行してください。
        </p>
        {alreadyLinked && (
          <p className="text-xs text-green-700">This address is already linked.</p>
        )}
      </div>

      <div className="border rounded-xl p-4">
        <div className="font-semibold mb-2">Linked wallets (DB)</div>
        {loading ? (
          <div>Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No linked wallets yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((w) => (
              <li key={w.id} className="border rounded p-3">
                <div className="font-mono break-all">{w.address}</div>
                <div className="text-xs text-muted-foreground">
                  {w.verified ? "verified" : "unverified"} • {w.created_at ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

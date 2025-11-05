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

  const normalizedInput = useMemo(() => addressInput?.trim(), [addressInput]);

  const alreadyLinked = useMemo(() => {
    if (!normalizedInput) return false;
    return rows.some(
      (r) => r.address?.toLowerCase() === normalizedInput.toLowerCase()
    );
  }, [rows, normalizedInput]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);

    // network列が無い環境でも動くよう最小列だけ選択
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

  /**
   * 署名 & 検証 & DB upsert
   * - Edge Function: verify-wallet-signature
   * - invoke には Authorization: Bearer <token> を必ず付与
   */
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

    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) {
      alert("Session not found. Please re-login.");
      return;
    }

    if (!(window as any).ethereum) {
      alert("Please install MetaMask.");
      return;
    }

    setLinking(true);
    try {
      // 1) ノンス取得
      const {
        data: nonceData,
        error: nonceErr,
      } = await supabase.functions.invoke("verify-wallet-signature", {
        headers: { Authorization: `Bearer ${token}` },
        body: { action: "nonce" },
      });

      if (nonceErr) {
        const details = JSON.stringify(nonceErr, null, 2);
        throw new Error(`Nonce request failed via invoke.\n${details}`);
      }
      const nonce = nonceData?.nonce;
      if (!nonce) {
        throw new Error(
          `Nonce not returned from Edge Function.\nRaw: ${JSON.stringify(
            nonceData
          )}`
        );
      }

      // 2) 署名（EIP-191 personal_sign）
      // MetaMaskの仕様上、現在接続中のアカウントで署名されます。
      // 第二引数に署名者アドレス（=現在選択中のアカウント）を渡します。
      let signature: string;
      try {
        signature = await (window as any).ethereum.request({
          method: "personal_sign",
          params: [nonce, normalizedInput],
        });
      } catch (e: any) {
        console.error("[wallets] personal_sign error:", e);
        throw new Error(`Signature failed: ${e?.message ?? e}`);
      }

      // 3) 検証 → DB upsert
      const {
        data: verifyData,
        error: verifyErr,
      } = await supabase.functions.invoke("verify-wallet-signature", {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          action: "verify",
          address: normalizedInput,
          signature,
          nonce,
        },
      });

      if (verifyErr) {
        const details = JSON.stringify(verifyErr, null, 2);
        throw new Error(`Verify request failed via invoke.\n${details}`);
      }
      if (!verifyData?.ok) {
        throw new Error(
          `Verification failed.\nRaw: ${JSON.stringify(verifyData)}`
        );
      }

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
            className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={handleLink}
            disabled={linking}
          >
            {linking ? "Linking..." : "Link Wallet"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          ※ MetaMask の署名ポップアップが表示されます。
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

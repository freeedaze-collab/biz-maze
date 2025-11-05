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

  const normalizedInput = useMemo(
    () => (addressInput ?? "").trim(),
    [addressInput]
  );

  const alreadyLinked = useMemo(() => {
    if (!normalizedInput) return false;
    return rows.some(
      (r) => r.address?.toLowerCase() === normalizedInput.toLowerCase()
    );
  }, [rows, normalizedInput]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);

    // network カラムが無い環境があるため列は最小に
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
   *   - POST { action: 'nonce' } → { nonce }
   *   - POST { action: 'verify', address, signature, nonce } → { ok: true }
   * - いずれも Authorization: Bearer <JWT> を付与（invokeヘッダ）
   */
  const handleLink = async () => {
    try {
      if (!user?.id) throw new Error("Please login again.");
      if (!normalizedInput) throw new Error("Please input your wallet address.");
      if (!isAddress(normalizedInput))
        throw new Error("Invalid Ethereum address format.");
      if (alreadyLinked)
        throw new Error("This wallet is already linked to your account.");

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error("Session not found. Please re-login.");

      if (!(window as any).ethereum) {
        throw new Error("Please install MetaMask.");
      }

      setLinking(true);

      // 1) ノンス取得
      const { data: nonceData, error: nonceErr } = await supabase.functions.invoke(
        "verify-wallet-signature",
        {
          headers: { Authorization: `Bearer ${token}` },
          body: { action: "nonce" },
        }
      );
      if (nonceErr) {
        const details = JSON.stringify(nonceErr, null, 2);
        throw new Error(`Nonce request failed via invoke.\n${details}`);
      }
      const nonce: string | undefined = nonceData?.nonce;
      if (!nonce) {
        throw new Error(
          `Nonce not returned from Edge Function.\nRaw: ${JSON.stringify(
            nonceData
          )}`
        );
      }

      // 2) 署名（EIP-191 personal_sign）
      // MetaMask の personal_sign は [message, account] の順
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

      // 3) 検証→DB登録
      const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
        "verify-wallet-signature",
        {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            action: "verify",
            address: normalizedInput,
            signature,
            nonce,
          },
        }
      );
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
        新しいウォレットを連携するには、アドレスを入力後に MetaMask で<strong>署名</strong>してください。
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
          ※ MetaMask の署名ポップアップが表示されます。署名後に所有者確認と保存を行います。
        </p>
        {alreadyLinked && (
          <p className="text-xs text-green-700">
            This address is already linked.
          </p>
        )}
      </div>

      {/* 連携済み一覧（DB） */}
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
                  {w.verified ? "verified" : "unverified"} •{" "}
                  {w.created_at ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

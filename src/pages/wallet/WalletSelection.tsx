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

  const normalized = useMemo(() => (addressInput ?? "").trim(), [addressInput]);

  const alreadyLinked = useMemo(() => {
    if (!normalized) return false;
    return rows.some((r) => r.address?.toLowerCase() === normalized.toLowerCase());
  }, [rows, normalized]);

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

  const handleLink = async () => {
    if (!user?.id) return alert("Please login again.");
    if (!normalized) return alert("Please input your wallet address.");
    if (!isAddress(normalized)) return alert("Invalid Ethereum address format.");
    if (!(window as any).ethereum) return alert("Please install MetaMask.");
    if (alreadyLinked) return alert("This wallet is already linked to your account.");

    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return alert("Session not found. Please re-login.");

    setLinking(true);
    try {
      // 1) nonce
      const { data: nonceData, error: nonceErr } = await supabase.functions.invoke(
        "verify-wallet-signature",
        {
          headers: { Authorization: `Bearer ${token}` },
          body: { action: "nonce" },
        }
      );
      if (nonceErr) {
        console.error("[invoke:nonce] error=", nonceErr, "data=", nonceData);
        alert(
          `Nonce failed.\n${JSON.stringify(nonceErr, null, 2)}\nRaw=${JSON.stringify(
            nonceData
          )}`
        );
        return;
      }
      const nonce: string | undefined = nonceData?.nonce;
      if (!nonce) {
        alert(`Nonce not returned.\nRaw=${JSON.stringify(nonceData)}`);
        return;
      }

      // 2) 署名（EIP-191 personal_sign）
      // MetaMaskのpersonal_signは [message, account] 順。message=nonce, account=入力アドレス。
      let signature: string;
      try {
        signature = await (window as any).ethereum.request({
          method: "personal_sign",
          params: [nonce, normalized],
        });
      } catch (e: any) {
        console.error("[wallets] personal_sign error:", e);
        alert(`Signature failed: ${e?.message ?? e}`);
        return;
      }

      // 3) verify
      const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
        "verify-wallet-signature",
        {
          headers: { Authorization: `Bearer ${token}` },
          body: { action: "verify", address: normalized, signature, nonce },
        }
      );
      if (verifyErr) {
        console.error("[invoke:verify] error=", verifyErr, "data=", verifyData);
        alert(
          `Verify failed.\n${JSON.stringify(verifyErr, null, 2)}\nRaw=${JSON.stringify(
            verifyData
          )}`
        );
        return;
      }
      if (!verifyData?.ok) {
        alert(`Verification failed.\nRaw=${JSON.stringify(verifyData)}`);
        return;
      }

      setAddressInput("");
      await load();
      alert("Wallet has been linked successfully.");
    } catch (e: any) {
      console.error("[wallets] link fatal:", e);
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
        新規登録は<strong>アドレス入力 → 署名 → 登録</strong>の順で本人性を確認します。
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

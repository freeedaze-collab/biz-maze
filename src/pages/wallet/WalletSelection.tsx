// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isAddress } from "viem";
import { getSupabaseJwt } from "@/utils/authToken";

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

    // network列がないDBでも落ちないよう必要最小限でselect
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
   * 入力 → 署名 → 検証（Edge Function）→ DB upsert
   * - Authorization: Bearer <JWT> を「必ず」付与（getSupabaseJwtで総当たり）
   * - MetaMask の現在アカウントが入力アドレスと一致していない場合は署名前に警告
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

    // 0) JWT を確実に取得
    const token = await getSupabaseJwt();
    if (!token) {
      alert("Session token not found. Please re-login.");
      return;
    }

    // 1) MetaMask 署名者の確認（現在の選択アカウントと入力アドレスの一致）
    if (!(window as any).ethereum) {
      alert("MetaMask not found. Please install or enable it.");
      return;
    }
    let current: string | undefined;
    try {
      const accounts: string[] = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      current = accounts?.[0];
    } catch (e: any) {
      console.error("[wallets] eth_requestAccounts error:", e);
      alert(`Failed to access MetaMask accounts: ${e?.message ?? e}`);
      return;
    }
    if (!current) {
      alert("No MetaMask account connected.");
      return;
    }
    if (current.toLowerCase() !== normalizedInput.toLowerCase()) {
      alert(
        "The selected MetaMask account is different from the input address.\n" +
          "Please switch MetaMask to the input address and try again."
      );
      return;
    }

    setLinking(true);
    try {
      // 2) ノンス取得（POST: action='nonce'）
      const nonceResp = await fetch(
        "https://ymddtgbsybvxfitgupqy.functions.supabase.co/functions/v1/verify-wallet-signature",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: "nonce" }),
        }
      );
      const nonceJson = await nonceResp
        .json()
        .catch(() => ({ error: "invalid json" }));
      console.log("[nonce]", nonceResp.status, nonceJson);
      if (!nonceResp.ok || !nonceJson?.nonce) {
        throw new Error(
          `Nonce failed: status=${nonceResp.status}, body=${JSON.stringify(
            nonceJson
          )}`
        );
      }
      const nonce: string = nonceJson.nonce;

      // 3) 署名（EIP-191 personal_sign）
      let signature: string;
      try {
        signature = await (window as any).ethereum.request({
          method: "personal_sign",
          params: [nonce, current],
        });
      } catch (e: any) {
        console.error("[wallets] personal_sign error:", e);
        throw new Error(`Signature failed: ${e?.message ?? e}`);
      }

      // 4) 検証→DB登録（POST: action='verify'）
      const verifyResp = await fetch(
        "https://ymddtgbsybvxfitgupqy.functions.supabase.co/functions/v1/verify-wallet-signature",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "verify",
            address: normalizedInput,
            signature,
            nonce,
          }),
        }
      );
      const verifyText = await verifyResp.text();
      console.log("[verify]", verifyResp.status, verifyText);

      if (!verifyResp.ok) {
        throw new Error(
          `Verify failed: status=${verifyResp.status}, body=${verifyText}`
        );
      }
      const parsed = safeJson(verifyText);
      if (!parsed?.ok) {
        throw new Error(`Verify error: ${verifyText}`);
      }

      // 5) 完了
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
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={handleLink}
            disabled={linking}
          >
            {linking ? "Linking..." : "Link Wallet"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          MetaMask の署名ポップアップが表示されます（メッセージはサーバ発行の nonce）。
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

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

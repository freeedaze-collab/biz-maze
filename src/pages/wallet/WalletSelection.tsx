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

const FN_URL = import.meta.env.VITE_FUNCTION_VERIFY_WALLET as string; 
// 例: "https://<project-id>.functions.supabase.co/functions/v1/verify-wallet-signature"

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

  // --- viem を ES Module で確実にロード（UMD/CSP問題回避）
  async function ensureViem() {
    // 既にどこかで import 済みなら再利用
    if ((window as any).__viem_eSM__) return (window as any).__viem_eSM__;
    const mod = await import("https://esm.sh/viem@2.18.8?bundle&target=es2020");
    (window as any).__viem_eSM__ = mod;
    return mod;
  }

  // --- 署名→verify
  const handleLink = async () => {
    try {
      if (!user?.id) {
        alert("Please login again.");
        return;
      }
      if (!normalizedInput || !isAddress(normalizedInput)) {
        alert("Please input a valid Ethereum address.");
        return;
      }
      if (alreadyLinked) {
        alert("This wallet is already linked to your account.");
        return;
      }
      if (!(window as any).ethereum) {
        alert("MetaMask not found.");
        return;
      }

      // JWT を取得（DB保存時に user を紐付けるため Authorization を付与）
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        alert("Session not found. Please re-login.");
        return;
      }

      setLinking(true);

      // 1) GET /verify-wallet-signature → { nonce }
      const r1 = await fetch(FN_URL, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const b1 = await r1.json().catch(() => ({}));
      if (!r1.ok || !b1?.nonce) {
        throw new Error(
          `Nonce fetch failed. status=${r1.status} body=${JSON.stringify(b1)}`
        );
      }
      const nonce: string = b1.nonce;

      // 2) 署名メッセージを“文字列”で統一
      const message = `BizMaze Wallet Link\nnonce=${nonce}`;

      // 3) 署名者＝現在の MetaMask アカウント
      const [account] = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!account) throw new Error("No MetaMask account.");

      // 入力と接続中アカウントを合わせる（異なると検証で落ちる）
      if (account.toLowerCase() !== normalizedInput.toLowerCase()) {
        alert(
          "The selected MetaMask account differs from the input address. Please switch the account and retry."
        );
        return;
      }

      // 4) viem（ESM）をロードし、toHex を使用して personal_sign の実装差を吸収
      const viem = await ensureViem();
      const { toHex, recoverMessageAddress } = viem;

      let signature: string;
      // 標準順（[message, account]）をまず試す
      try {
        signature = await (window as any).ethereum.request({
          method: "personal_sign",
          params: [toHex(message), account],
        });
      } catch {
        // 一部実装は逆順を要求することがある
        signature = await (window as any).ethereum.request({
          method: "personal_sign",
          params: [account, toHex(message)],
        });
      }

      // 5) ローカルでも即座に復元して一致確認（デバッグ用）
      const recoveredLocal = await recoverMessageAddress({ message, signature });
      const localSame =
        recoveredLocal.toLowerCase() === account.toLowerCase();
      console.log("[local recover]", {
        account,
        recoveredLocal,
        same: localSame,
        sigLen: signature.length,
      });
      if (!localSame) {
        throw new Error(
          `Local recover mismatch. recovered=${recoveredLocal}, account=${account}`
        );
      }

      // 6) POST /verify-wallet-signature → 検証＆DB upsert
      const r2 = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "verify",
          address: account,
          signature,
          message, // ← ここがポイント：サーバも“同じ文字列”で検証する
        }),
      });
      const t2 = await r2.text();
      let b2: any = null;
      try {
        b2 = JSON.parse(t2);
      } catch {
        b2 = t2;
      }
      console.log("[verify resp]", r2.status, b2);

      if (!r2.ok || !b2?.ok) {
        throw new Error(
          `Verify failed. status=${r2.status} body=${JSON.stringify(b2)}`
        );
      }

      setAddressInput("");
      await load();
      alert("Wallet has been linked successfully.");
    } catch (e: any) {
      console.error("[wallets] link error:", e);
      alert(e?.message ?? String(e));
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
          署名メッセージは <code>BizMaze Wallet Link\ nnonce=&lt;nonce&gt;</code> です（文字列のまま）。<br />
          入力したアドレスと MetaMask の選択アカウントは<strong>同一である必要</strong>があります。
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

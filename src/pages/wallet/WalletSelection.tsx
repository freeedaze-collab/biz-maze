// src/pages/wallet/WalletSelection.tsx
// 仕様：
// - 「Link Wallet」を押す → 入力欄表示
// - アドレスを入力 → Verify & Link（MetaMask署名→Edge Functionで検証→DB保存）
// - 保存済みウォレットの一覧（Verified / Pending はUIで表現。失敗は一覧に出さない）
// - MetaMask未接続でも署名時に自動的に接続要求が出ます
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type WalletRow = {
  id: string;
  user_id: string;
  address: string;
  verified: boolean;
  created_at: string;
};

declare global {
  interface Window {
    ethereum?: any;
  }
}

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");

export default function WalletSelection() {
  const { user, session } = useAuth();

  const [phase, setPhase] = useState<"idle"|"input">("idle");
  const [inputAddress, setInputAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const FUNCTIONS_BASE = useMemo(() => {
    const url = (import.meta.env.VITE_SUPABASE_URL as string) || "";
    return url.replace(/\/+$/, "") + "/functions/v1";
  }, []);

  const loadWallets = async () => {
    if (!user) return;
    setLoadingList(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data || []) as WalletRow[]);
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (user) loadWallets();
  }, [user]);

  const startLinking = () => {
    setPhase("input");
    setMsg(null);
  };

  const verifyAndLink = async () => {
    setMsg(null);
    if (!session?.access_token) {
      setMsg("Not signed in.");
      return;
    }
    if (!isEthAddress(inputAddress)) {
      setMsg("Invalid address (0x + 40 hex).");
      return;
    }
    if (!window.ethereum) {
      setMsg("MetaMask not found. Please install MetaMask.");
      return;
    }
    try {
      setBusy(true);

      // 1) ノンス取得（GET）
      const r1 = await fetch(`${FUNCTIONS_BASE}/verify_wallet`, {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const j1 = await r1.json();
      if (!r1.ok || !j1?.nonce) throw new Error(j1?.error || "Failed to get nonce");
      const nonce: string = j1.nonce;

      // 2) MetaMask で署名（personal_sign）
      // MetaMask は [message, address] の順で渡す
      const signature: string = await window.ethereum.request({
        method: "personal_sign",
        params: [nonce, inputAddress],
      });

      // 3) 署名検証 & 保存（POST）
      const r2 = await fetch(`${FUNCTIONS_BASE}/verify_wallet`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ address: inputAddress, signature }),
      });
      const j2 = await r2.json().catch(() => ({}));
      if (!r2.ok || !j2?.ok) throw new Error(j2?.error || `Verification failed (${r2.status})`);

      setMsg("Wallet verified & linked.");
      setInputAddress("");
      await loadWallets();
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Wallet Creation / Linking</h1>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="text-sm text-muted-foreground">
          Add your EVM wallet. We verify ownership by signing a one-time nonce in MetaMask.
        </div>

        {phase === "idle" ? (
          <button
            className="bg-primary text-primary-foreground px-4 py-2 rounded"
            onClick={startLinking}
          >
            Link Wallet
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Wallet address</label>
              <input
                className={`w-full border rounded px-2 py-1 font-mono ${inputAddress && !isEthAddress(inputAddress) ? "border-red-500" : ""}`}
                placeholder="0x..."
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value.trim())}
              />
              {inputAddress && !isEthAddress(inputAddress) && (
                <div className="text-xs text-red-600 mt-1">
                  Invalid address format (must be 0x + 40 hex chars).
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                onClick={verifyAndLink}
                disabled={!isEthAddress(inputAddress) || busy}
              >
                {busy ? "Verifying..." : "Verify & Link with MetaMask"}
              </button>
              <button
                className="px-4 py-2 rounded border"
                onClick={() => { setPhase("idle"); setInputAddress(""); setMsg(null); }}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {msg && <div className="text-sm">{msg}</div>}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Your wallets</h2>
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={loadWallets}
            disabled={loadingList}
          >
            {loadingList ? "Loading..." : "Reload"}
          </button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2">Address</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={3}>
                    No wallets yet. Add one above.
                  </td>
                </tr>
              ) : (
                rows.map((w) => (
                  <tr key={w.id} className="border-t">
                    <td className="px-3 py-2 font-mono break-all">{w.address}</td>
                    <td className="px-3 py-2">
                      {w.verified ? "Verified ✅" : "Pending ⌛"}
                    </td>
                    <td className="px-3 py-2">
                      {new Date(w.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// src/pages/wallet/WalletSelection.tsx
// 目的: 3点(入力アドレス/署名アドレス/サーバ復元アドレス)のズレを即発見できるよう詳細ログ＆UIデバッグ表示を追加
// - 「Use connected account」ボタンで MetaMask の現在アカウントを入力欄へ自動セット
// - 署名前に signer と入力値の一致を「画面に」明示
// - サーバ応答エラー時は詳細ヒント表示

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
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
    };
  }
}

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");
const toL = (v: string) => (v || "").trim().toLowerCase();

export default function WalletSelection() {
  const { user, session } = useAuth();

  const [phase, setPhase] = useState<"idle" | "input">("idle");
  const [inputAddress, setInputAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debug, setDebug] = useState<any>({});

  const FUNCTIONS_BASE = useMemo(() => {
    const url = (import.meta.env.VITE_SUPABASE_URL as string) || "";
    const base = url.replace(/\/+$/, "") + "/functions/v1";
    if (import.meta.env.DEV) {
      console.log("[WalletSelection] SUPABASE_URL:", url);
      console.log("[WalletSelection] FUNCTIONS_BASE:", base);
    }
    return base;
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
    setStep(0);
    setDebug({});
  };

  const fillFromMetaMask = async () => {
    setMsg(null);
    if (!window.ethereum) {
      setMsg("MetaMask not found. Please install MetaMask.");
      return;
    }
    try {
      const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = toL(accounts?.[0] || "");
      if (!isEthAddress(signer)) {
        setMsg("No valid MetaMask account selected.");
        return;
      }
      setInputAddress(signer);
      setDebug((d: any) => ({ ...d, signer }));
    } catch (e: any) {
      setMsg(e?.message || String(e));
    }
  };

  const verifyAndLink = async () => {
    setMsg(null);
    setStep(0);

    if (!session?.access_token) {
      setMsg("Not signed in.");
      return;
    }
    if (!isEthAddress(inputAddress)) {
      setMsg("Invalid address (must be 0x + 40 hex).");
      return;
    }
    if (!window.ethereum) {
      setMsg("MetaMask not found. Please install MetaMask and try again.");
      return;
    }

    try {
      setBusy(true);

      // A) 実署名アカウントを取得
      const accounts: string[] = await window.ethereum
        .request({ method: "eth_requestAccounts" });
      const signer = toL(accounts?.[0] || "");
      if (!isEthAddress(signer)) throw new Error("No valid MetaMask account selected.");

      const inputL = toL(inputAddress);
      const equal = signer === inputL;

      setDebug((d: any) => ({ ...d, signer, inputL, equal }));

      if (!equal) {
        setMsg(
          [
            "The address you entered does not match the selected account in MetaMask.",
            `Entered: ${inputL}`,
            `MetaMask: ${signer}`,
            "",
            "Please either:",
            "  • Switch the selected account in MetaMask to the entered address, or",
            "  • Click 'Use connected account' to auto-fill the current MetaMask address.",
          ].join("\n")
        );
        return;
      }

      // 1) Nonce 取得
      setStep(1);
      const r1 = await fetch(`${FUNCTIONS_BASE}/verify_wallet`, {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch((e) => {
        throw new Error(`Failed to reach server (GET nonce). ${e?.message || e}`);
      });

      let nonce = "";
      if (!r1.ok) {
        const detail = await r1.text().catch(() => "");
        throw new Error(`Server responded ${r1.status} on GET nonce. ${detail}`);
      } else {
        const j1 = await r1.json().catch(() => ({}));
        if (!j1?.nonce) throw new Error("Nonce not returned from server.");
        nonce = j1.nonce as string;
      }
      setDebug((d: any) => ({ ...d, nonce }));

      // 2) MetaMask で署名（署名者は signer）
      setStep(2);
      const signature: string = await window.ethereum.request({
        method: "personal_sign",
        params: [nonce, signer],
      });
      setDebug((d: any) => ({ ...d, sigLen: signature.length }));

      // 3) 検証＆保存
      setStep(3);
      const r2 = await fetch(`${FUNCTIONS_BASE}/verify_wallet`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ address: inputAddress, signature }),
      }).catch((e) => {
        throw new Error(`Failed to reach server (POST verify). ${e?.message || e}`);
      });

      const txt = await r2.text().catch(() => "");
      let j2: any = {};
      try { j2 = JSON.parse(txt); } catch { /* ignore */ }

      setDebug((d: any) => ({ ...d, postStatus: r2.status, postBody: txt.slice(0, 300) }));

      if (!r2.ok) {
        throw new Error(`Server responded ${r2.status} on POST verify. ${txt}`);
      }
      if (!j2?.ok) throw new Error(j2?.error || "Verification failed.");

      setStep(4);
      setMsg("Wallet verified & linked.");
      setInputAddress("");
      await loadWallets();
    } catch (e: any) {
      const m = String(e?.message || e);
      setMsg(m.includes("Failed to reach server")
        ? m + "\n\nHints:\n- Function deployed? Verify JWT ON?\n- Secrets set?\n- CORS allowed?\n- URL correct? (see debug panel)"
        : m
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Wallet Creation / Linking</h1>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="text-sm text-muted-foreground">
          We’ll verify you own the wallet by asking MetaMask to sign a one-time code (nonce), then we validate it on the server.
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
            {/* 入力欄 */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-semibold mb-1">Wallet address (EVM)</label>
                <input
                  className={`w-full border rounded px-2 py-1 font-mono ${
                    inputAddress && !isEthAddress(inputAddress) ? "border-red-500" : ""
                  }`}
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
              <button
                className="px-3 py-2 border rounded"
                onClick={fillFromMetaMask}
                title="Use MetaMask's currently selected account"
              >
                Use connected account
              </button>
            </div>

            {/* ステップ表示 */}
            <div className="text-sm">
              <div className="mb-1 font-semibold">What will happen:</div>
              <ol className="list-decimal ml-5 space-y-1">
                <li className={step >= 1 ? "font-semibold" : ""}>
                  Request a one-time code (nonce) from the server
                </li>
                <li className={step >= 2 ? "font-semibold" : ""}>
                  MetaMask opens to sign the nonce with your selected account
                </li>
                <li className={step >= 3 ? "font-semibold" : ""}>
                  We verify the signature and save your wallet
                </li>
                <li className={step >= 4 ? "font-semibold" : ""}>Done! The wallet appears in your list</li>
              </ol>
            </div>

            <div className="flex gap-2">
              <button
                className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                onClick={verifyAndLink}
                disabled={!isEthAddress(inputAddress) || busy}
                title={!isEthAddress(inputAddress) ? "Enter a valid 0x-address first" : ""}
              >
                {busy ? "Verifying..." : "Verify & Link with MetaMask"}
              </button>
              <button
                className="px-4 py-2 rounded border"
                onClick={() => { setPhase("idle"); setInputAddress(""); setMsg(null); setStep(0); setDebug({}); }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="ml-auto text-xs underline"
                onClick={() => setDebugOpen((v) => !v)}
              >
                {debugOpen ? "Hide debug" : "Show debug"}
              </button>
            </div>

            {msg && <div className="text-sm whitespace-pre-wrap">{msg}</div>}

            {debugOpen && (
              <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-56">
{JSON.stringify({
  FUNCTIONS_BASE,
  inputAddress,
  debug,
  hasSession: !!session?.access_token,
  tokenPreview: session?.access_token?.slice(0, 12) + "...",
}, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* 一覧 */}
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
                    <td className="px-3 py-2">{w.verified ? "Verified ✅" : "Pending ⌛"}</td>
                    <td className="px-3 py-2">{new Date(w.created_at).toLocaleString()}</td>
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

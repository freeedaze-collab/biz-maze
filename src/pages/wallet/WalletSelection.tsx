// src/pages/wallet/WalletSelection.tsx
// 目的：Docker不要で原因を確定させるため、POST時に x-debug: 1 を付与し、サーバから dbg を受け取って画面に出す。
// ※ 本番は x-debug を外してください。
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: any[] }) => Promise<any> };
  }
}
const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");
const toL = (v: string) => (v || "").trim().toLowerCase();

export default function WalletSelection() {
  const { session } = useAuth();
  const [phase, setPhase] = useState<"idle"|"input">("idle");
  const [inputAddress, setInputAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>({});
  const [showDebug, setShowDebug] = useState(false);

  const FUNCTIONS_BASE = useMemo(() => {
    const url = (import.meta.env.VITE_SUPABASE_URL as string) || "";
    return url.replace(/\/+$/, "") + "/functions/v1";
  }, []);

  const start = () => { setPhase("input"); setMsg(null); setDebug({}); };

  const fillFromMetaMask = async () => {
    setMsg(null);
    if (!window.ethereum) return setMsg("MetaMask not found.");
    try {
      const accs: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = toL(accs?.[0] || "");
      if (!isEthAddress(signer)) return setMsg("No valid MetaMask account selected.");
      setInputAddress(signer);
      setDebug((d: any) => ({ ...d, signer }));
    } catch (e: any) {
      setMsg(e?.message || String(e));
    }
  };

  const verifyAndLink = async () => {
    setMsg(null);
    setDebug({});
    if (!session?.access_token) return setMsg("Not signed in.");
    if (!isEthAddress(inputAddress)) return setMsg("Invalid address (0x + 40 hex).");
    if (!window.ethereum) return setMsg("MetaMask not found.");

    try {
      setBusy(true);

      // 実署名アカウント
      const accs: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = toL(accs?.[0] || "");
      const inputL = toL(inputAddress);
      setDebug((d: any) => ({ ...d, signer, inputL, equal: signer === inputL }));
      if (signer !== inputL) {
        setMsg([
          "Entered address ≠ MetaMask selected account.",
          `Entered: ${inputL}`,
          `MetaMask: ${signer}`,
        ].join("\n"));
        return;
      }

      // Nonce
      const r1 = await fetch(`${FUNCTIONS_BASE}/verify_wallet`, {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const j1 = await r1.json();
      if (!r1.ok || !j1?.nonce) throw new Error("Failed to get nonce");
      setDebug((d: any) => ({ ...d, nonce: j1.nonce }));

      // 署名
      const signature: string = await window.ethereum.request({
        method: "personal_sign",
        params: [j1.nonce, signer],
      });
      setDebug((d: any) => ({ ...d, sigLen: signature.length }));

      // 検証 (x-debug:1 でサーバが recovered/input を返す)
      const r2 = await fetch(`${FUNCTIONS_BASE}/verify_wallet`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "x-debug": "1",
        },
        body: JSON.stringify({ address: inputAddress, signature }),
      });
      const txt = await r2.text();
      let body: any = {};
      try { body = JSON.parse(txt); } catch {}
      setDebug((d: any) => ({ ...d, postStatus: r2.status, postBody: body }));

      if (!r2.ok) {
        // ここで body.dbg.input / body.dbg.recovered を目視できます
        throw new Error(body?.error || `Server ${r2.status}`);
      }

      setMsg("Wallet verified & linked.");
      setInputAddress("");
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Wallet Creation / Linking</h1>

      {phase === "idle" ? (
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={start}>
          Link Wallet
        </button>
      ) : (
        <div className="space-y-3 border rounded p-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold mb-1">Wallet address (EVM)</label>
              <input
                className={`w-full border rounded px-2 py-1 font-mono ${inputAddress && !isEthAddress(inputAddress) ? "border-red-500" : ""}`}
                placeholder="0x..."
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value.trim())}
              />
            </div>
            <button className="px-3 py-2 border rounded" onClick={fillFromMetaMask}>
              Use connected account
            </button>
          </div>

          <div className="flex gap-2">
            <button
              className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
              onClick={verifyAndLink}
              disabled={!isEthAddress(inputAddress) || busy}
            >
              {busy ? "Verifying..." : "Verify & Link with MetaMask"}
            </button>
            <button className="px-4 py-2 border rounded" onClick={() => { setPhase("idle"); setMsg(null); setDebug({}); }}>
              Cancel
            </button>
            <button className="ml-auto text-xs underline" onClick={() => setShowDebug((v) => !v)}>
              {showDebug ? "Hide debug" : "Show debug"}
            </button>
          </div>

          {msg && <div className="text-sm whitespace-pre-wrap">{msg}</div>}

          {showDebug && (
            <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-64">
{JSON.stringify({
  FUNCTIONS_BASE,
  inputAddress,
  debug,
}, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

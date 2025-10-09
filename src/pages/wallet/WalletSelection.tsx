// src/pages/wallet/WalletSelection.tsx
// 依存を最小化：wagmi のコネクタは使わず window.ethereum を直接叩く安全版
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type EthProvider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  isMetaMask?: boolean;
};

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");
// ※ verify_wallet まで含めたフルURLにしておく
const FUNCTIONS_URL = `${(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "")}/functions/v1/verify_wallet`;

export default function WalletSelection() {
  const { user } = useAuth();
  const [connected, setConnected] = useState<string | null>(null);
  const [inputAddress, setInputAddress] = useState("");
  const [phase, setPhase] = useState<"idle" | "input" | "signing" | "linked">("idle");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [debug, setDebug] = useState<any | null>(null);

  // GETで取得した nonce を保持（POST に同梱する）
  const [nonce, setNonce] = useState<string>("");

  const valid = useMemo(() => isEthAddress(inputAddress), [inputAddress]);
  const short = useMemo(
    () => (connected ? `${connected.slice(0, 6)}...${connected.slice(-4)}` : "-"),
    [connected]
  );

  useEffect(() => {
    (async () => {
      try {
        const eth = (window as any).ethereum as EthProvider | undefined;
        if (!eth) return;
        const accts = await eth.request({ method: "eth_accounts" });
        if (accts?.[0]) setConnected(accts[0]);
      } catch {/* noop */}
    })();
  }, []);

  const connectMetaMask = async () => {
    setMsg(null);
    setDebug(null);
    try {
      const eth = (window as any).ethereum as EthProvider | undefined;
      if (!eth || !eth.request) throw new Error("MetaMask not detected. Please install/unlock MetaMask.");
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      if (!accounts?.[0]) throw new Error("No account returned from MetaMask.");
      setConnected(accounts[0]);
      setInputAddress(accounts[0]);
      setPhase("input");
      setMsg("Connected to MetaMask.");
    } catch (e: any) {
      setMsg(e?.message || String(e));
    }
  };

  const verifyAndLink = async () => {
    setMsg(null);
    setDebug(null);
    if (!valid) {
      setMsg("Invalid Ethereum address format (0x + 40 hex).");
      return;
    }
    try {
      setBusy(true);

      const eth = (window as any).ethereum as EthProvider | undefined;
      if (!eth || !eth.request) throw new Error("MetaMask not detected.");

      // Supabase セッション取得（Edge Functions への認可に使用）
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token || "";
      if (!token) throw new Error("Not signed in.");

      // 1) Nonce を GET（必ずここで受け取った値を POST に同梱する）
      const getRes = await fetch(FUNCTIONS_URL, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const getJson = await getRes.json();
      if (!getRes.ok || !getJson?.nonce) {
        throw new Error(getJson?.error || "Failed to get nonce.");
      }
      const gotNonce: string = getJson.nonce;
      setNonce(gotNonce);

      // 2) MetaMask で署名（personal_sign は [message, address] の順）
      const signature: string = await eth.request({
        method: "personal_sign",
        params: [gotNonce, inputAddress],
      });

      // 3) 検証 & 保存（POST: signature と nonce を両方送る）
      const postRes = await fetch(FUNCTIONS_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          address: inputAddress,
          signature,
          nonce: gotNonce, // ←★ これが必須（今回のエラー原因）
        }),
      });
      const postBody = await postRes.json().catch(() => ({}));

      setDebug({
        FUNCTIONS_BASE: FUNCTIONS_URL,
        inputAddress,
        nonce: gotNonce,
        sigLen: signature?.length ?? 0,
        postStatus: postRes.status,
        postBody,
      });

      if (!postRes.ok || !postBody?.ok) {
        throw new Error(postBody?.error || "Signature does not match the address");
      }

      setPhase("linked");
      setMsg("Wallet linked successfully.");
      // 任意：profiles.primary_wallet にも反映
      if (user) {
        await supabase.from("profiles").update({ primary_wallet: inputAddress }).eq("user_id", user.id);
      }
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const manualSave = async () => {
    setMsg(null);
    setDebug(null);
    try {
      if (!user) throw new Error("Not signed in.");
      if (!valid) throw new Error("Invalid Ethereum address.");
      const { error } = await supabase.from("profiles").update({ primary_wallet: inputAddress }).eq("user_id", user.id);
      if (error) throw error;
      setPhase("linked");
      setMsg("Saved manually (ownership not verified).");
    } catch (e: any) {
      setMsg(e?.message || String(e));
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Wallet Creation / Linking</h1>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="font-semibold">MetaMask</div>
            <div>{connected ? "Connected" : "Disconnected"}</div>
          </div>
          <div>
            <div className="font-semibold">Account</div>
            <div className="font-mono break-all">{connected ?? "-"}</div>
          </div>
          <div>
            <div className="font-semibold">Short</div>
            <div>{connected ? short : "-"}</div>
          </div>
          <div>
            <div className="font-semibold">Nonce (last)</div>
            <div className="font-mono break-all text-xs">{nonce || "-"}</div>
          </div>
        </div>

        {!connected && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={connectMetaMask}>
            Connect MetaMask
          </button>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Wallet address (EVM)</label>
            <div className="flex gap-2">
              <input
                className={`w-full border rounded px-2 py-1 font-mono ${
                  inputAddress && !valid ? "border-red-500" : ""
                }`}
                placeholder="0x..."
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value.trim())}
              />
              {connected && (
                <button
                  className="px-3 py-1 border rounded"
                  onClick={() => setInputAddress(connected)}
                  title="Use connected MetaMask account"
                >
                  Use connected
                </button>
              )}
            </div>
            {!valid && inputAddress && (
              <div className="text-xs text-red-600 mt-1">Invalid address format (0x + 40 hex).</div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
              onClick={verifyAndLink}
              disabled={!valid || busy}
            >
              {busy ? "Verifying..." : "Verify & Link with MetaMask"}
            </button>
            <button className="px-4 py-2 rounded border disabled:opacity-50" onClick={manualSave} disabled={!valid || busy}>
              Save manually
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: After clicking “Verify & Link”, MetaMask will open a signature window. Sign to prove ownership.
          </p>
        </div>

        {msg && <div className="text-sm">{msg}</div>}

        {debug && (
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
            {JSON.stringify(debug, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

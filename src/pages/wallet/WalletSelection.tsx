// src/pages/wallet/WalletSelection.tsx
// 署名方式を EIP-712 Typed Data に変更。サーバと同一 domain/types/primaryType を使用して検証。

import { useMemo, useState } from "react";
import { useAccount, useBalance, useConnect, useDisconnect, useSignTypedData } from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const FN_URL =
  (import.meta.env.VITE_FUNCTION_VERIFY_WALLET as string | undefined) ??
  `${(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "")}/functions/v1/verify-wallet-signature`;

const domain = { name: "BizMaze", version: "1" } as const;
const types = {
  WalletLink: [
    { name: "wallet", type: "address" as const },
    { name: "nonce",  type: "string"  as const },
  ],
} as const;

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");

export default function WalletSelection() {
  const { user } = useAuth();
  const { address: connected, isConnected } = useAccount();
  const { connect, isPending } = useConnect({ connector: new InjectedConnector() });
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address: connected, query: { enabled: !!connected } });
  const { signTypedDataAsync } = useSignTypedData();

  const [phase, setPhase] = useState<"idle"|"input"|"linking"|"done">("idle");
  const [inputAddress, setInputAddress] = useState("");
  const [nonce, setNonce] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [debug, setDebug] = useState<any | null>(null);

  const valid = useMemo(() => isEthAddress(inputAddress), [inputAddress]);
  const short = useMemo(
    () => (connected ? `${connected.slice(0, 6)}...${connected.slice(-4)}` : "-"),
    [connected]
  );

  const start = () => {
    setPhase("input");
    setMsg(null);
    setDebug(null);
  };

  const useConnected = () => {
    if (connected) setInputAddress(connected);
  };

  const verifyAndLink = async () => {
    setMsg(null);
    setDebug(null);

    try {
      if (!valid) throw new Error("Invalid address.");
      if (!isConnected) await connect();
      if (!connected) throw new Error("MetaMask not connected.");
      if (connected.toLowerCase() !== inputAddress.toLowerCase()) {
        throw new Error("Entered address does not match connected account.");
      }

      setPhase("linking");

      // 1) Nonce 取得
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token ?? "";
      const r = await fetch(FN_URL, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (!r.ok || !j?.nonce) throw new Error(j?.error || "Failed to get nonce");
      const n: string = j.nonce;
      setNonce(n);

      // 2) EIP-712 署名
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: "WalletLink",
        message: { wallet: inputAddress as `0x${string}`, nonce: n },
      });

      // 3) 検証 POST
      const post = await fetch(FN_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ address: inputAddress, nonce: n, signature }),
      });
      const body = await post.json();

      setDebug({
        FUNCTIONS_BASE: FN_URL,
        inputAddress,
        nonce: n,
        sigLen: signature.length,
        postStatus: post.status,
        postBody: body,
      });

      if (!post.ok || !body?.ok) throw new Error(body?.error || "Verification failed");

      setMsg("Wallet linked successfully.");
      setPhase("done");
    } catch (e: any) {
      setMsg(e?.message || String(e));
      setPhase("input");
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Wallet Creation / Linking</h1>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-semibold">MetaMask</div>
            <div>{isConnected ? "Connected" : (isPending ? "Connecting..." : "Disconnected")}</div>
          </div>
          <div>
            <div className="font-semibold">Account</div>
            <div className="font-mono break-all">{isConnected ? connected : "-"}</div>
          </div>
          <div>
            <div className="font-semibold">Short</div>
            <div>{short}</div>
          </div>
          <div>
            <div className="font-semibold">Balance</div>
            <div>{balance ? `${balance.formatted} ${balance.symbol}` : "-"}</div>
          </div>
          <div>
            <div className="font-semibold">Nonce (last)</div>
            <div className="font-mono break-all">{nonce ?? "-"}</div>
          </div>
        </div>

        {phase === "idle" && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={start}>
            Link Wallet
          </button>
        )}

        {phase !== "idle" && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">Wallet address (EVM)</label>
            <div className="flex gap-2">
              <input
                className={`flex-1 border rounded px-2 py-1 font-mono ${inputAddress && !valid ? "border-red-500" : ""}`}
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value.trim())}
                placeholder="0x..."
              />
              <button className="px-3 py-1 rounded border" onClick={useConnected} disabled={!connected}>
                Use connected account
              </button>
            </div>
            {!valid && inputAddress && (
              <div className="text-xs text-red-600">Invalid address format (0x + 40 hex).</div>
            )}

            <div className="flex gap-2">
              <button
                className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                onClick={verifyAndLink}
                disabled={!valid || phase === "linking"}
              >
                {phase === "linking" ? "Verifying…" : "Verify & Link with MetaMask"}
              </button>
              <button className="px-4 py-2 rounded border" onClick={() => disconnect()} disabled={!isConnected}>
                Disconnect
              </button>
            </div>

            {msg && <div className="text-sm">{msg}</div>}

            {debug && (
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
                {JSON.stringify(debug, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

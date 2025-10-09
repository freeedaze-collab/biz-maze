// src/pages/wallet/WalletSelection.tsx
import { useMemo, useState } from "react";
import { useAccount, useBalance, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { injected } from "wagmi/connectors";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");

const FUNCTIONS_BASE =
  (import.meta.env.VITE_FUNCTION_VERIFY_WALLET as string)?.replace(/\/+$/, "") ||
  ""; // e.g. https://<project>.supabase.co/functions/v1/verify-wallet-signature

export default function WalletSelection() {
  const { user } = useAuth();

  // wagmi
  const { address: connected, isConnected } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address: connected, query: { enabled: !!connected } });
  const { signMessageAsync } = useSignMessage();

  // UI state
  const [phase, setPhase] = useState<"idle" | "input" | "signing" | "linked">("idle");
  const [inputAddress, setInputAddress] = useState("");
  const [messageToSign, setMessageToSign] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const debug: Record<string, any> = {};

  const valid = useMemo(() => isEthAddress(inputAddress), [inputAddress]);
  const short = useMemo(
    () => (connected ? `${connected.slice(0, 6)}...${connected.slice(-4)}` : "-"),
    [connected]
  );

  // -------- helpers
  async function bearer() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  function assertEnv() {
    if (!FUNCTIONS_BASE) {
      throw new Error("VITE_FUNCTION_VERIFY_WALLET is empty. Put the full function URL.");
    }
  }

  // -------- flow
  async function start() {
    setNote(null);
    setPhase("input");
    setMessageToSign("");
  }

  async function fetchMessage(addressL: string) {
    assertEnv();
    const token = await bearer();
    const url = FUNCTIONS_BASE + "?address=" + addressL; // GET returns { message }
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.message) throw new Error(j?.error || "Failed to get message");
    return j.message as string;
  }

  async function verifyAndLink() {
    setNote(null);
    if (!valid) {
      setNote("Invalid address format (0x + 40 hex).");
      return;
    }
    try {
      setBusy(true);

      // 1) connect MetaMask if needed (wagmi v2)
      if (!isConnected) {
        await connect({ connector: injected() });
      }
      if (!connected) throw new Error("MetaMask not connected.");

      const inputL = inputAddress.toLowerCase();
      const signerL = connected.toLowerCase();
      if (inputL !== signerL) throw new Error("Entered address and MetaMask account differ.");

      // 2) GET message from Edge Function
      const message = await fetchMessage(inputL);
      setMessageToSign(message);
      debug.message = message;

      // 3) Sign exactly that string
      setPhase("signing");
      const signature = await signMessageAsync({ message });
      debug.sigLen = signature?.length || 0;

      // 4) POST for verification
      assertEnv();
      const token = await bearer();
      const r = await fetch(FUNCTIONS_BASE, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address: inputAddress, signature, message }),
      });
      const j = await r.json().catch(() => ({}));
      debug.postStatus = r.status;
      debug.postBody = j;

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Verification failed.");
      }

      setPhase("linked");
      setNote("Wallet linked successfully.");
    } catch (e: any) {
      setNote(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  // ---------- UI
  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Wallet Creation / Linking</h1>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="text-sm text-muted-foreground">
          Tip: After clicking “Verify &amp; Link”, MetaMask will open a signature window. Sign to
          prove ownership.
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-semibold">MetaMask</div>
            <div>{isConnected ? "Connected" : isConnecting ? "Connecting..." : "Disconnected"}</div>
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
        </div>

        {phase === "idle" && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={start}>
            Link Wallet
          </button>
        )}

        {phase !== "idle" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Your wallet address</label>
              <input
                className={`w-full border rounded px-2 py-1 font-mono ${
                  inputAddress && !valid ? "border-red-500" : ""
                }`}
                placeholder="0x..."
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value.trim())}
              />
              {!valid && inputAddress && (
                <div className="text-xs text-red-600 mt-1">
                  Invalid address format (must be 0x + 40 hex chars).
                </div>
              )}
            </div>

            {!!messageToSign && (
              <div className="text-xs break-all bg-muted/30 p-2 rounded">
                <div className="font-semibold mb-1">Message (read-only)</div>
                {messageToSign}
              </div>
            )}

            <div className="flex gap-2">
              <button
                className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                onClick={verifyAndLink}
                disabled={!valid || busy}
              >
                {busy ? (phase === "signing" ? "Awaiting signature..." : "Verifying...") : "Verify & Link with MetaMask"}
              </button>

              <button className="px-4 py-2 rounded border" onClick={() => disconnect()} disabled={!isConnected}>
                Disconnect MetaMask
              </button>

              <button className="px-4 py-2 rounded border" onClick={() => setShowDebug((v) => !v)}>
                {showDebug ? "Hide debug" : "Show debug"}
              </button>
            </div>
          </div>
        )}

        {note && <div className="text-sm">{note}</div>}

        {showDebug && (
          <pre className="text-xs bg-muted/30 p-2 rounded overflow-auto">
            {JSON.stringify(
              {
                FUNCTIONS_BASE: FUNCTIONS_BASE || "(empty)",
                inputAddress,
                messageToSign,
                debug,
              },
              null,
              2
            )}
          </pre>
        )}
      </div>
    </div>
  );
}

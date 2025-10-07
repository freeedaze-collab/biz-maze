// src/pages/wallet/WalletSelection.tsx
// フロー：
// 1) 「Link Wallet」→ アドレス入力欄が表示
// 2) アドレス入力（0x + 40hex バリデーション）
// 3) 「Verify & Link」→ MetaMask接続 → 入力アドレスと接続アカウント一致を確認
// 4) Edge Function: GET(Nonce) → 署名 → POST(検証&保存)

import { useState, useMemo } from "react";
import { useAccount, useBalance, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");

// ★ Edge Function のフルURL（相対ではなくフル）にするのが重要！
const FUNCTIONS_BASE = `${(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "")}/functions/v1/verify_wallet`;

export default function WalletSelection() {
  const { user } = useAuth();
  const { address: connected, isConnected } = useAccount();
  const { connect, isPending: connecting } = useConnect({ connector: new InjectedConnector() });
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address: connected, query: { enabled: !!connected } });
  const { signMessageAsync } = useSignMessage();

  const [phase, setPhase] = useState<"idle"|"input"|"verifying"|"linked">("idle");
  const [inputAddress, setInputAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const valid = useMemo(() => isEthAddress(inputAddress), [inputAddress]);
  const short = useMemo(
    () => (connected ? `${connected.slice(0, 6)}...${connected.slice(-4)}` : "-"),
    [connected]
  );

  const startLinking = () => {
    setPhase("input");
    setMsg(null);
  };

  const verifyAndLink = async () => {
    setMsg(null);
    if (!valid) {
      setMsg("Invalid Ethereum address format (0x + 40 hex chars required).");
      return;
    }
    try {
      setBusy(true);

      // 1) MetaMask 接続
      if (!isConnected) {
        await connect();
      }
      if (!connected) throw new Error("MetaMask not connected.");

      // 2) 入力アドレスと接続アカウント一致チェック
      if (connected.toLowerCase() !== inputAddress.toLowerCase()) {
        throw new Error("Entered address does not match your connected MetaMask account.");
      }

      // 3) Nonce取得（Edge Function GET）
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token || "";
      const getRes = await fetch(FUNCTIONS_BASE, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const getJson = await getRes.json();
      if (!getRes.ok || !getJson?.nonce) {
        throw new Error(getJson?.error || "Failed to get nonce.");
      }

      // 4) 署名
      const signature = await signMessageAsync({ message: getJson.nonce });

      // 5) 検証&保存（Edge Function POST）
      const postRes = await fetch(FUNCTIONS_BASE, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address: inputAddress, signature }),
      });
      const postJson = await postRes.json();
      if (!postRes.ok || !postJson?.ok) {
        throw new Error(postJson?.error || "Verification failed.");
      }

      setPhase("linked");
      setMsg("Wallet linked successfully.");
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const manualSave = async () => {
    setMsg(null);
    try {
      if (!user) throw new Error("Not signed in.");
      if (!valid) throw new Error("Invalid Ethereum address format.");
      // （注意）手動保存は本人検証なし。推奨は verifyAndLink の署名フロー。
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
        <div className="text-sm text-muted-foreground">
          Link your Ethereum wallet. We verify ownership by matching your MetaMask account and a signed nonce.
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-semibold">MetaMask</div>
            <div>{isConnected ? "Connected" : (connecting ? "Connecting..." : "Disconnected")}</div>
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
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={startLinking}>
            Link Wallet
          </button>
        )}

        {phase !== "idle" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Your wallet address</label>
              <input
                className={`w-full border rounded px-2 py-1 font-mono ${inputAddress && !valid ? "border-red-500" : ""}`}
                placeholder="0x..."
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value.trim())}
              />
              {!valid && inputAddress && (
                <div className="text-xs text-red-600 mt-1">Invalid address format (must be 0x + 40 hex chars).</div>
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

              <button className="px-4 py-2 rounded border" onClick={() => disconnect()} disabled={!isConnected}>
                Disconnect MetaMask
              </button>
            </div>

            <div className="text-xs text-muted-foreground">
              Tip: We verify you control the entered address by matching your MetaMask account and a signed nonce.
            </div>

            <hr className="my-2" />

            <div className="space-y-2">
              <div className="text-xs font-semibold">Fallback (not recommended)</div>
              <button
                className="px-4 py-2 rounded border disabled:opacity-50"
                onClick={manualSave}
                disabled={!valid || busy}
              >
                Save manually (without ownership verification)
              </button>
            </div>
          </div>
        )}

        {msg && <div className="text-sm">{msg}</div>}
      </div>
    </div>
  );
}

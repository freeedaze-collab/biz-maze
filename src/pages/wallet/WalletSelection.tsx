// src/pages/wallet/WalletSelection.tsx
// 署名メッセージのズレをなくすため、Edge Function から返る signText をそのまま署名します。
// さらにフロント側でも verifyMessage(signText, signature) を実行して recoveredLocal を表示し、原因切り分けを容易にします。

import { useMemo, useState } from "react";
import { useAccount, useBalance, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { verifyMessage } from "ethers";

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");
const FUNCTIONS_BASE = `${(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "")}/functions/v1/verify_wallet`;

type DebugBlock = Record<string, unknown>;

export default function WalletSelection() {
  const { user } = useAuth();
  const { address: connected, isConnected } = useAccount();
  const { connect, isPending: connecting } = useConnect({ connector: new InjectedConnector() });
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address: connected, query: { enabled: !!connected } });
  const { signMessageAsync } = useSignMessage();

  const [phase, setPhase] = useState<"idle" | "input" | "verifying" | "linked">("idle");
  const [inputAddress, setInputAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugBlock | null>(null);
  const [showDbg, setShowDbg] = useState(false);

  const valid = useMemo(() => isEthAddress(inputAddress), [inputAddress]);
  const short = useMemo(
    () => (connected ? `${connected.slice(0, 6)}...${connected.slice(-4)}` : "-"),
    [connected]
  );

  const startLinking = () => {
    setPhase("input");
    setMsg(null);
    setDebug(null);
  };

  // 入力欄を接続中アカウントで埋めるショートカット
  const useConnected = () => {
    if (connected) setInputAddress(connected);
  };

  const verifyAndLink = async () => {
    setMsg(null);
    setDebug(null);

    if (!valid) {
      setMsg("Invalid Ethereum address format (0x + 40 hex chars).");
      return;
    }
    try {
      setBusy(true);

      // 1) MetaMask 接続
      if (!isConnected) await connect();
      if (!connected) throw new Error("MetaMask not connected.");

      // 2) 入力アドレスと接続アカウント一致チェック（ここが false なら必ず失敗する）
      const eq = connected.toLowerCase() === inputAddress.toLowerCase();
      if (!eq) {
        throw new Error("Entered address does not match your connected MetaMask account.");
      }

      // 3) Edge Function GET: nonce と signText を取得（← これを必ず署名する）
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token || "";
      const getRes = await fetch(`${FUNCTIONS_BASE}?dbg=1`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const getJson = await getRes.json();
      if (!getRes.ok || !getJson?.signText) {
        throw new Error(getJson?.error || "Failed to get signText.");
      }

      const signText: string = getJson.signText;
      const nonce: string = getJson.nonce;

      // 4) 署名（サーバから返された signText をそのまま使う）
      //    ※ ここで改行・空白・トリミング等を一切行わないこと
      const signature = await signMessageAsync({ message: signText });

      // 4.5) ローカルでも検証してみる（原因切り分けのため）
      let recoveredLocal = "";
      try {
        recoveredLocal = verifyMessage(signText, signature).toLowerCase();
      } catch (e) {
        recoveredLocal = `(local verify error: ${String(e)})`;
      }

      // 5) Edge Function POST: サーバ側でも同じ signText を再構成し検証
      const postRes = await fetch(`${FUNCTIONS_BASE}?dbg=1`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address: inputAddress, signature }),
      });
      const postBody = await postRes.json();

      // デバッグ表示（画面に情報を出す）
      setDebug({
        FUNCTIONS_BASE,
        inputAddress,
        signer: connected?.toLowerCase(),
        inputL: inputAddress.toLowerCase(),
        equal: eq,
        nonce,
        sigLen: signature.length,
        signTextPreview: signText.length > 120 ? signText.slice(0, 120) + " …" : signText,
        recoveredLocal,
        postStatus: postRes.status,
        postBody,
      });

      if (!postRes.ok || !postBody?.ok) {
        throw new Error(postBody?.error || "Server verification failed");
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
      const { error } = await supabase
        .from("profiles")
        .update({ primary_wallet: inputAddress })
        .eq("user_id", user.id);
      if (error) throw error;
      setPhase("linked");
      setMsg("Saved manually (ownership not verified).");
    } catch (e: any) {
      setMsg(e?.message || String(e));
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Wallet Creation / Linking</h1>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="text-sm text-muted-foreground">
          Link your Ethereum wallet. We verify ownership by matching your MetaMask account and a signed message from the server.
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
            <label className="block text-sm font-semibold">Wallet address (EVM)</label>
            <div className="flex gap-2">
              <input
                className={`flex-1 border rounded px-2 py-1 font-mono ${inputAddress && !valid ? "border-red-500" : ""}`}
                placeholder="0x..."
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value.trim())}
              />
              <button className="px-3 py-1 rounded border" onClick={useConnected} disabled={!connected}>
                Use connected account
              </button>
            </div>
            {!valid && inputAddress && (
              <div className="text-xs text-red-600">Invalid address format (0x + 40 hex chars).</div>
            )}

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
              <button className="px-3 py-2 rounded border" onClick={() => setShowDbg(s => !s)}>
                {showDbg ? "Hide debug" : "Show debug"}
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Tip: A MetaMask signature window will appear. If not, ensure MetaMask is unlocked and pop-ups are allowed.
            </p>

            <hr className="my-2" />

            <div className="space-y-2">
              <div className="text-xs font-semibold">Fallback (not recommended)</div>
              <button className="px-4 py-2 rounded border disabled:opacity-50" onClick={manualSave} disabled={!valid || busy}>
                Save manually (without ownership verification)
              </button>
            </div>
          </div>
        )}

        {msg && <div className="text-sm">{msg}</div>}
        {showDbg && (
          <pre className="text-xs bg-muted/40 p-2 rounded overflow-x-auto">
            {JSON.stringify(
              {
                FUNCTIONS_BASE,
                inputAddress,
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

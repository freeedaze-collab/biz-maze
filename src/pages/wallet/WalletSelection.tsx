// ユーザーの操作フロー：
// 1) 「Link Wallet」ボタン → アドレス入力欄が出る
// 2) アドレスを入力（0x... 形式チェック）
// 3) 「Verify & Link with MetaMask」→ MetaMaskと接続し、入力アドレスと選択アカウント一致チェック
// 4) 署名フロー：Edge Function(GETでnonce取得→署名→POSTで検証) → 成功したら profiles.primary_wallet に保存
// 5) 非接続・MetaMask無しの場合でも「Manual Save」（但し本人性検証は不可なので非推奨／推奨は上記の署名フロー）

import { useState, useMemo } from "react";
import { useAccount, useBalance, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");

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
      setMsg("Invalid Ethereum address format.");
      return;
    }
    try {
      setBusy(true);

      // 1) MetaMask 接続
      if (!isConnected) {
        await connect();
      }
      if (!connected) throw new Error("MetaMask not connected.");

      // 2) 入力アドレスと接続中アカウントの一致チェック
      if (connected.toLowerCase() !== inputAddress.toLowerCase()) {
        throw new Error("Entered address does not match your connected MetaMask account.");
      }

      // 3) Nonce 取得（Edge Function）
      const getRes = await fetch("/functions/v1/verify_wallet", {
        method: "GET",
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}` },
      });
      const getJson = await getRes.json();
      if (!getRes.ok || !getJson?.nonce) {
        throw new Error(getJson?.error || "Failed to get nonce.");
      }

      const nonce: string = getJson.nonce;

      // 4) 署名（EIP-191）
      const signature = await signMessageAsync({ message: nonce });

      // 5) 検証 & 保存（Edge Function）
      const postRes = await fetch("/functions/v1/verify_wallet", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
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
      // ★注意：本人性検証なし（推奨フローは verifyAndLink）
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
          Link your Ethereum wallet. We verify ownership by matching your MetaMask account and signature.
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-semibold">MetaMask</div>
            <div>{isConnected ? "Connected" : "Disconnected"}</div>
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
              Tip: This verifies you control the entered address by matching your MetaMask account and a signed nonce.
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

// TransferNew.tsx
// 目的: 送金フォーム（宛先/金額を入力 → Edge Functionで事前検証 → MetaMaskで送金実行）
// wagmi の connector は使わず、既存の接続状態(useAccount)前提で安全実装

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { supabase } from "@/integrations/supabase/client";

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");
const isPositiveNumber = (s: string) => /^(\d+)(\.\d{1,18})?$/.test(s || ""); // 小数18桁まで

function ethToHexWei(eth: string) {
  const [w, f = ""] = eth.split(".");
  const WEI = 10n ** 18n;
  const whole = BigInt(w || "0") * WEI;
  const frac = BigInt((f + "0".repeat(18)).slice(0, 18));
  const total = whole + frac;
  return "0x" + total.toString(16);
}

// Edge Function フルURL
const PREFLIGHT_URL = `${(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "")}/functions/v1/preflight_transfer`;

export default function TransferNew() {
  const { address: connected, isConnected } = useAccount();

  const [to, setTo] = useState("");
  const [amountEth, setAmountEth] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const validTo = useMemo(() => isEthAddress(to), [to]);
  const validAmt = useMemo(() => isPositiveNumber(amountEth), [amountEth]);

  const handleReview = async () => {
    setMsg(null);
    setTxHash(null);
    if (!isConnected || !connected) {
      setMsg("Please connect MetaMask first.");
      return;
    }
    if (!validTo || !validAmt) {
      setMsg("Please enter a valid recipient and amount.");
      return;
    }

    try {
      setBusy(true);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token || "";

      // 送金前のサーバ側チェック
      const res = await fetch(PREFLIGHT_URL, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from: connected, to, amountEth }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Preflight check failed.");
      }

      setReview(true);
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    setMsg(null);
    setTxHash(null);
    if (!(window as any).ethereum) {
      setMsg("Ethereum provider not found. Please install MetaMask.");
      return;
    }
    try {
      setBusy(true);
      const value = ethToHexWei(amountEth);
      // MetaMask で送金
      const hash: string = await (window as any).ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: connected, to, value }],
      });
      setTxHash(hash);
      setMsg("Transaction submitted.");

      // （任意）DB記録：transactionsテーブルがある想定
      const { error } = await supabase.from("transactions").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        to_address: to,
        from_address: connected,
        amount_eth: amountEth,
        tx_hash: hash,
        status: "submitted",
      });
      if (error) {
        // 記録失敗は致命ではないのでメッセだけ
        console.warn("Insert transactions failed:", error);
      }
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setBusy(false);
      setReview(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Transfer (ETH)</h1>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="text-sm">
          From (connected): <span className="font-mono">{isConnected ? connected : "(not connected)"}</span>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Recipient (0x...)</label>
          <input
            className={`w-full border rounded px-2 py-1 font-mono ${to && !validTo ? "border-red-500" : ""}`}
            placeholder="0x..."
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
          />
          {!validTo && to && <div className="text-xs text-red-600 mt-1">Invalid Ethereum address.</div>}
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Amount (ETH)</label>
          <input
            className={`w-full border rounded px-2 py-1 ${amountEth && !validAmt ? "border-red-500" : ""}`}
            placeholder="0.01"
            inputMode="decimal"
            value={amountEth}
            onChange={(e) => setAmountEth(e.target.value.trim())}
          />
          {!validAmt && amountEth && <div className="text-xs text-red-600 mt-1">Invalid amount (max 18 decimals).</div>}
        </div>

        {!review ? (
          <button
            className="bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50"
            onClick={handleReview}
            disabled={busy || !validTo || !validAmt}
          >
            {busy ? "Checking..." : "Review"}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="text-sm bg-muted p-2 rounded">
              <div>Recipient: <span className="font-mono">{to}</span></div>
              <div>Amount: {amountEth} ETH</div>
            </div>
            <div className="flex gap-2">
              <button
                className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                onClick={handleSend}
                disabled={busy}
              >
                {busy ? "Sending..." : "Send with MetaMask"}
              </button>
              <button className="px-4 py-2 rounded border" onClick={() => setReview(false)} disabled={busy}>
                Back
              </button>
            </div>
          </div>
        )}

        {txHash && (
          <div className="text-sm">
            Tx Hash:{" "}
            <a className="text-blue-600 underline" href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
              {txHash}
            </a>
          </div>
        )}

        {msg && <div className="text-sm">{msg}</div>}
      </div>
    </div>
  );
}

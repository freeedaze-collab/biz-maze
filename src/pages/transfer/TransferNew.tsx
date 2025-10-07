import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, type Address } from "viem";

const isEthAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || "");

export default function TransferNew() {
  const { user } = useAuth();
  const { address: from, isConnected } = useAccount();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const validAddr = useMemo(() => isEthAddress(to), [to]);
  const validAmt = useMemo(() => Number(amount) > 0, [amount]);

  const { data: hash, isPending, error, sendTransaction } = useSendTransaction();
  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    const update = async () => {
      if (!user || !hash) return;
      await supabase.from("transfers").insert({
        user_id: user.id,
        wallet_address: to,
        amount: Number(amount),
        currency: "ETH",
        tx_hash: hash,
        status: "submitted",
      });
    };
    update();
  }, [hash, user?.id]);

  useEffect(() => {
    const mark = async () => {
      if (!user || !hash) return;
      if (receipt.isSuccess) {
        await supabase.from("transfers").update({ status: "success" }).eq("user_id", user.id).eq("tx_hash", hash);
      } else if (receipt.isError) {
        await supabase.from("transfers").update({ status: "failed" }).eq("user_id", user.id).eq("tx_hash", hash);
      }
    };
    mark();
  }, [receipt.status, receipt.isSuccess, receipt.isError, hash, user?.id]);

  const precheckServer = async (addr: string) => {
    // Edge Function 側で署名検証は不要（送金時は宛先のみチェック）
    // 必要に応じて別の関数にしてもOK。ここでは verify_wallet を簡易再利用するなら GETのみでなく専用の関数を作るのが綺麗。
    // 例：/functions/v1/validate_address を別途用意し、フォーマットやブラックリスト等を確認。
    // ここでは最小限：有効フォーマットはクライアントで保証済みなのでそのままOKとする。
    return true;
  };

  const onSend = async () => {
    setMsg(null);
    try {
      if (!isConnected) throw new Error("Please connect MetaMask first.");
      if (!validAddr) throw new Error("Invalid destination address.");
      if (!validAmt) throw new Error("Amount must be greater than 0.");

      const ok = await precheckServer(to);
      if (!ok) throw new Error("Server validation rejected this address.");

      sendTransaction({ to: to as Address, value: parseEther(amount) });
    } catch (e: any) {
      setMsg(e?.message || String(e));
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New recipient</h1>

      {!confirming ? (
        <div className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Destination (ETH address)</label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              placeholder="0x..."
              className={`w-full border rounded px-2 py-1 font-mono ${to && !validAddr ? "border-red-500" : ""}`}
            />
            {!validAddr && to && (
              <div className="text-xs text-red-600 mt-1">Invalid address (0x + 40 hex chars required)</div>
            )}
          </div>

          <div>
            <label className="block font-semibold mb-1">Amount (ETH)</label>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.01"
              className={`w-full border rounded px-2 py-1 ${amount && !validAmt ? "border-red-500" : ""}`}
            />
            {!validAmt && amount && <div className="text-xs text-red-600 mt-1">Enter a positive number.</div>}
          </div>

          <div className="flex gap-2">
            <button
              className="bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50"
              onClick={() => setConfirming(true)}
              disabled={!validAddr || !validAmt}
            >
              Review
            </button>
            <button className="px-4 py-2 rounded border" onClick={() => history.back()}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 border rounded p-4">
          <div className="text-sm text-muted-foreground">Confirm transfer</div>
          <div className="text-sm">
            <div><span className="font-semibold">From:</span> <span className="font-mono">{from || "-"}</span></div>
            <div><span className="font-semibold">To:</span> <span className="font-mono">{to}</span></div>
            <div><span className="font-semibold">Amount:</span> {amount} ETH</div>
          </div>
          <div className="flex gap-2">
            <button
              className="bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50"
              onClick={onSend}
              disabled={isPending}
            >
              {isPending ? "Sending..." : "Send with MetaMask"}
            </button>
            <button className="px-4 py-2 rounded border" onClick={() => setConfirming(false)}>
              Back
            </button>
          </div>

          {msg && <div className="text-sm text-destructive">{msg}</div>}
          {error && <div className="text-sm text-destructive">{String(error.message || error)}</div>}
          {hash && (
            <div className="text-sm">
              <div className="text-muted-foreground">Tx submitted</div>
              <div className="font-mono break-all">{hash}</div>
            </div>
          )}
          {receipt?.isSuccess && <div className="text-green-600 text-sm">Success!</div>}
        </div>
      )}
    </div>
  );
}

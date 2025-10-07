import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "wagmi";
import { useEthSend } from "@/lib/eth/send";
import { useNavigate } from "react-router-dom";

export default function TransferNew() {
  const { user } = useAuth();
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  const [recipientName, setRecipientName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const { sendEth, txHash, isPending, error, receipt } = useEthSend();

  useEffect(() => {
    // 送金後にDBへ記録
    const saveAfterHash = async () => {
      if (!user || !txHash) return;
      setSaving(true);
      try {
        // client を保存（任意：名前があれば）＆ wallet を記録
        let clientId: string | null = null;
        if (recipientName) {
          const { data, error } = await supabase
            .from("clients")
            .insert({ user_id: user.id, name: recipientName, wallet: walletAddress })
            .select("id")
            .single();
          if (!error && data) clientId = data.id;
        }

        await supabase.from("transfers").insert({
          user_id: user.id,
          client_id: clientId,
          wallet_address: walletAddress,
          amount: Number(amount),
          currency: "ETH",
          tx_hash: txHash,
          status: "submitted",
        });
      } finally {
        setSaving(false);
      }
    };
    saveAfterHash();
  }, [txHash, user, walletAddress, amount, recipientName]);

  // 成功でステータス更新
  useEffect(() => {
    const markSuccess = async () => {
      if (!user || !txHash) return;
      if (receipt.isSuccess) {
        await supabase
          .from("transfers")
          .update({ status: "success" })
          .eq("user_id", user.id)
          .eq("tx_hash", txHash);
      } else if (receipt.isError) {
        await supabase
          .from("transfers")
          .update({ status: "failed" })
          .eq("user_id", user.id)
          .eq("tx_hash", txHash);
      }
    };
    markSuccess();
  }, [receipt.status, receipt.isSuccess, receipt.isError, txHash, user]);

  const onConfirm = () => setConfirming(true);

  const onSend = () => {
    if (!isConnected) {
      alert("Please connect MetaMask on Wallet page first.");
      return;
    }
    if (!walletAddress || !amount) {
      alert("Wallet address and amount are required.");
      return;
    }
    sendEth(walletAddress, amount);
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New recipient</h1>

      {!confirming ? (
        <div className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Recipient name (optional)</label>
            <input
              className="border rounded w-full p-2"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="(optional)"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Wallet address (ETH)</label>
            <input
              className="border rounded w-full p-2 font-mono"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Amount (ETH)</label>
            <input
              className="border rounded w-full p-2"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.01"
            />
          </div>

          <div className="flex gap-2">
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={onConfirm}>
              Review
            </button>
            <button className="px-4 py-2 rounded border" onClick={() => navigate("/transfer")}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 border rounded p-4">
          <div className="text-sm text-muted-foreground">Confirm transfer</div>
          <div className="text-sm">
            <div><span className="font-semibold">To:</span> <span className="font-mono">{walletAddress || "-"}</span></div>
            <div><span className="font-semibold">Amount:</span> {amount} ETH</div>
            {!!recipientName && <div><span className="font-semibold">Save as client:</span> {recipientName}</div>}
          </div>
          <div className="flex gap-2">
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={onSend} disabled={isPending || saving}>
              {isPending ? "Sending..." : "Send with MetaMask"}
            </button>
            <button className="px-4 py-2 rounded border" onClick={() => setConfirming(false)}>
              Back
            </button>
          </div>

          {error && <div className="text-destructive text-sm">Error: {String(error.message || error)}</div>}
          {txHash && (
            <div className="text-sm">
              <div className="text-muted-foreground">Tx submitted</div>
              <div className="font-mono break-all">{txHash}</div>
            </div>
          )}
          {receipt?.isSuccess && (
            <div className="text-green-600 text-sm">Success! You can go back to Dashboard or Transfer.</div>
          )}
        </div>
      )}
    </div>
  );
}

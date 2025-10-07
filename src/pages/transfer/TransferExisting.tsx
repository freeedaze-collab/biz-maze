import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEthSend } from "@/lib/eth/send";
import { useNavigate } from "react-router-dom";

type Client = {
  id: string;
  name: string;
  wallet: string | null;
};

export default function TransferExisting() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);

  const { sendEth, txHash, isPending, error, receipt } = useEthSend();

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("clients")
        .select("id,name,wallet")
        .eq("user_id", user.id)
        .not("wallet", "is", null);
      setClients(data || []);
    })();
  }, [user?.id]);

  const chosen = clients.find((c) => c.id === clientId);
  const wallet = chosen?.wallet || "";

  const onConfirm = () => {
    if (!clientId || !amount) {
      alert("Client and amount are required.");
      return;
    }
    setConfirming(true);
  };

  const onSend = () => {
    if (!wallet) return;
    sendEth(wallet, amount);
  };

  useEffect(() => {
    const save = async () => {
      if (!user || !txHash || !clientId) return;
      await supabase.from("transfers").insert({
        user_id: user.id,
        client_id: clientId,
        wallet_address: wallet,
        amount: Number(amount),
        currency: "ETH",
        tx_hash: txHash,
        status: "submitted",
      });
    };
    save();
  }, [txHash, user, clientId, wallet, amount]);

  useEffect(() => {
    const update = async () => {
      if (!user || !txHash) return;
      if (receipt.isSuccess) {
        await supabase.from("transfers").update({ status: "success" }).eq("user_id", user.id).eq("tx_hash", txHash);
      } else if (receipt.isError) {
        await supabase.from("transfers").update({ status: "failed" }).eq("user_id", user.id).eq("tx_hash", txHash);
      }
    };
    update();
  }, [receipt.status, receipt.isSuccess, receipt.isError, txHash, user]);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Existing client</h1>

      {!confirming ? (
        <div className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Client</label>
            <select className="border rounded w-full p-2" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">-- Select client (with wallet) --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
            <div><span className="font-semibold">Client:</span> {chosen?.name || "-"}</div>
            <div><span className="font-semibold">Wallet:</span> <span className="font-mono">{wallet || "-"}</span></div>
            <div><span className="font-semibold">Amount:</span> {amount} ETH</div>
          </div>
          <div className="flex gap-2">
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={onSend} disabled={isPending}>
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
          {receipt?.isSuccess && <div className="text-green-600 text-sm">Success!</div>}
        </div>
      )}
    </div>
  );
}

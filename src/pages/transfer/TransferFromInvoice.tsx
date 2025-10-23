// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEthSend } from "@/lib/eth/send";
import { useNavigate } from "react-router-dom";

type InvoiceRow = {
  id: string;
  client_id: string | null;
  total_amount: number | null;
  currency: string | null;
  status: string | null;
  invoice_number: string | null;
};

type Client = {
  id: string;
  name: string;
  wallet: string | null;
};

export default function TransferFromInvoice() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [overrideWallet, setOverrideWallet] = useState("");

  const { sendEth, txHash, isPending, error, receipt } = useEthSend();

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: inv } = await supabase
        .from("invoices")
        .select("id, client_id, total_amount, currency, status, invoice_number")
        .eq("user_id", user.id)
        .in("status", ["unpaid", "pending"]);
      setInvoices(inv || []);

      const { data: cls } = await supabase
        .from("clients")
        .select("id, name, wallet")
        .eq("user_id", user.id);
      setClients(cls || []);
    })();
  }, [user?.id]);

  const selected = useMemo(() => invoices.find(i => i.id === invoiceId), [invoiceId, invoices]);
  const client = useMemo(
    () => (selected?.client_id ? clients.find(c => c.id === selected.client_id) : undefined),
    [selected?.client_id, clients]
  );

  const wallet = overrideWallet || client?.wallet || "";

  const onSend = async () => {
    if (!selected || !wallet || !selected.total_amount) {
      alert("Invoice, wallet and amount are required.");
      return;
    }
    sendEth(wallet, String(selected.total_amount));

    if (user) {
      await supabase.from("transfers").insert({
        user_id: user.id,
        client_id: client?.id ?? null,
        invoice_id: selected.id,
        wallet_address: wallet,
        amount: Number(selected.total_amount),
        currency: "ETH",
        tx_hash: null,
        status: "pending",
      });
    }
  };

  useEffect(() => {
    const attachHash = async () => {
      if (!user || !txHash || !selected) return;
      await supabase
        .from("transfers")
        .update({ tx_hash: txHash, status: "submitted" })
        .eq("user_id", user.id)
        .eq("invoice_id", selected.id)
        .is("tx_hash", null);
    };
    attachHash();
  }, [txHash, user, selected?.id]);

  useEffect(() => {
    const markSuccess = async () => {
      if (!user || !txHash || !selected) return;
      if (receipt.isSuccess) {
        await supabase
          .from("transfers")
          .update({ status: "success" })
          .eq("user_id", user.id)
          .eq("invoice_id", selected.id)
          .eq("tx_hash", txHash);

        // 請求書ステータスも更新（任意）
        await supabase
          .from("invoices")
          .update({ status: "paid" })
          .eq("user_id", user.id)
          .eq("id", selected.id);
      } else if (receipt.isError) {
        await supabase
          .from("transfers")
          .update({ status: "failed" })
          .eq("user_id", user.id)
          .eq("invoice_id", selected.id)
          .eq("tx_hash", txHash);
      }
    };
    markSuccess();
  }, [receipt.status, receipt.isSuccess, receipt.isError, txHash, user, selected?.id]);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Pay from invoice</h1>

      <div className="space-y-4">
        <div>
          <label className="block font-semibold mb-1">Invoice</label>
          <select className="border rounded w-full p-2" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">-- Select invoice --</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.invoice_number || i.id} / {i.total_amount ?? 0} {i.currency || "ETH"}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm">
          <div><span className="font-semibold">Client:</span> {client?.name || "-"}</div>
          <div><span className="font-semibold">Wallet (saved):</span> <span className="font-mono">{client?.wallet || "-"}</span></div>
        </div>

        <div>
          <label className="block font-semibold mb-1">Override wallet (optional)</label>
          <input
            className="border rounded w-full p-2 font-mono"
            value={overrideWallet}
            onChange={(e) => setOverrideWallet(e.target.value)}
            placeholder="0x... (leave empty to use client's wallet)"
          />
        </div>

        <div className="flex gap-2">
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={onSend} disabled={isPending || !invoiceId}>
            {isPending ? "Sending..." : "Send with MetaMask"}
          </button>
          <button className="px-4 py-2 rounded border" onClick={() => navigate("/transfer")}>
            Cancel
          </button>
        </div>

        {error && <div className="text-destructive text-sm">Error: {String(error.message || error)}</div>}
        {txHash && (
          <div className="text-sm">
            <div className="text-muted-foreground">Tx submitted</div>
            <div className="font-mono break-all">{txHash}</div>
          </div>
        )}
        {receipt?.isSuccess && <div className="text-green-600 text-sm">Success! Invoice marked as paid.</div>}
      </div>
    </div>
  );
}

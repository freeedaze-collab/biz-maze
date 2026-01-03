// src/pages/CreateInvoice.tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Item = { id: string; name: string; qty: number; unitPrice: number };

export default function CreateInvoice() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [invoiceNo, setInvoiceNo] = useState<string>(() => {
    const n = Date.now().toString().slice(-6);
    return `INV-${n}`;
  });
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState<number>(10);
  const [items, setItems] = useState<Item[]>([
    { id: crypto.randomUUID(), name: "", qty: 1, unitPrice: 0 },
  ]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const subTotal = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0),
    [items]
  );
  const tax = useMemo(() => subTotal * (Number(taxRate) || 0) / 100, [subTotal, taxRate]);
  const total = useMemo(() => subTotal + tax, [subTotal, tax]);

  const valid = useMemo(() => {
    if (!customerName.trim()) return false;
    if (!customerEmail.trim()) return false;
    if (!invoiceNo.trim()) return false;
    return items.every((it) => it.name.trim() && it.qty > 0 && it.unitPrice >= 0);
  }, [customerName, customerEmail, invoiceNo, items]);

  const addItem = () => setItems((prev) => [
    ...prev,
    { id: crypto.randomUUID(), name: "", qty: 1, unitPrice: 0 },
  ]);

  const removeItem = (id: string) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)));

  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const onSubmit = async (e: React.FormEvent, status: "draft" | "open" = "draft") => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to create an invoice");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          invoice_number: invoiceNo,
          customer_name: customerName,
          bill_to: customerEmail, // We'll use bill_to for the email for now
          currency,
          tax_rate: taxRate,
          items: items as any,
          notes,
          status,
          subtotal: subTotal,
          tax,
          total: total,
          amount: total,
        })
        .select()
        .single();

      if (error) {
        console.error("[CreateInvoice] DB Insert Error:", error);
        throw error;
      }

      console.log("[CreateInvoice] Saved data:", data);

      if (status === "open") {
        const checkoutUrl = `${window.location.origin}/checkout/${data.id}`;

        console.log("[CreateInvoice] Sending email to:", customerEmail, "with URL:", checkoutUrl);

        // --- Send Email via Edge Function ---
        try {
          const { data: funcData, error: funcError } = await supabase.functions.invoke("send-invoice-email", {
            body: {
              to: customerEmail,
              subject: `Invoice ${invoiceNo} from BizMaze`,
              text: `You have received a new invoice ${invoiceNo}. Please use the link below to view details and pay.`,
              checkoutUrl: checkoutUrl,
              invoiceNumber: invoiceNo,
            },
          });

          if (funcError) {
            console.error("[CreateInvoice] Email function error:", funcError);
            toast.error(`Invoice issued but email failed: ${funcError.message || JSON.stringify(funcError)}`);
          } else {
            console.log("[CreateInvoice] Email function success:", funcData);
            toast.success("Invoice issued and email sent!");
          }
        } catch (e: any) {
          console.error("[CreateInvoice] Invoke wrap error:", e);
          toast.error("Failed to trigger email system.");
        }
        // ------------------------------------

        alert(`Invoice issued! Payment link: ${checkoutUrl}`);
      } else {
        toast.success("Draft saved successfully");
      }

      navigate("/billing");
    } catch (error: any) {
      console.error("[CreateInvoice] error:", error);
      toast.error(error.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create invoice</h1>
        <Link to="/billing" className="text-sm underline text-muted-foreground">
          Back to Invoices
        </Link>
      </div>

      <form className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm mb-1 font-medium text-slate-700">Invoice No.</label>
            <input
              className="w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium text-slate-700">Currency</label>
            <select
              className="w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option>USD</option>
              <option>JPY</option>
              <option>EUR</option>
              <option>INR</option>
              <option>SGD</option>
              <option>GBP</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium text-slate-700">Tax rate (%)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              type="number"
              step="1"
              min={0}
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1 font-medium text-slate-700">Company / Client Name</label>
            <input
              className="w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Google Japan G.K."
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium text-slate-700">Customer Email</label>
            <input
              className="w-full border rounded-lg px-3 py-2 bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="billing@example.com"
              required
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Items</h2>
            <button type="button" onClick={addItem} className="text-sm underline">
              + Add item
            </button>
          </div>

          {items.map((it) => (
            <div key={it.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 border rounded p-3">
              <div className="md:col-span-3">
                <label className="block text-sm mb-1">Name</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={it.name}
                  onChange={(e) => updateItem(it.id, { name: e.target.value })}
                  placeholder="Service / Product name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Qty</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  type="number"
                  min={1}
                  value={it.qty}
                  onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Unit price</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  type="number"
                  min={0}
                  step="any"
                  value={it.unitPrice}
                  onChange={(e) => updateItem(it.id, { unitPrice: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  className="text-sm underline text-red-600"
                  disabled={items.length <= 1}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Notes</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms or message to the client"
            />
          </div>

          <div className="border rounded-xl p-4 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="font-mono">{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tax ({taxRate}%)</span>
              <span className="font-mono">{tax.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2 mt-2">
              <span className="font-semibold text-lg">Total</span>
              <span className="font-mono font-bold text-lg">{total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            type="button"
            disabled={!valid || saving}
            onClick={(e) => onSubmit(e, "draft")}
            className="flex-1 border-2 border-primary text-primary font-semibold px-4 py-3 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save draft"}
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={(e) => onSubmit(e, "open")}
            className="flex-1 bg-primary text-white font-semibold px-4 py-3 rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
          >
            {saving ? "Issuing..." : "Issue & Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

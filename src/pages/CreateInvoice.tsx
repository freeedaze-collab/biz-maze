// src/pages/CreateInvoice.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type Item = { id: string; name: string; qty: number; unitPrice: number };

export default function CreateInvoice() {
  const [invoiceNo, setInvoiceNo] = useState<string>(() => {
    const n = Date.now().toString().slice(-6);
    return `INV-${n}`;
  });
  const [billTo, setBillTo] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState<number>(10);
  const [items, setItems] = useState<Item[]>([
    { id: crypto.randomUUID(), name: "", qty: 1, unitPrice: 0 },
  ]);
  const [notes, setNotes] = useState("");

  const subTotal = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0),
    [items]
  );
  const tax = useMemo(() => subTotal * (Number(taxRate) || 0) / 100, [subTotal, taxRate]);
  const total = useMemo(() => subTotal + tax, [subTotal, tax]);

  const valid = useMemo(() => {
    if (!billTo.trim()) return false;
    if (!invoiceNo.trim()) return false;
    return items.every((it) => it.name.trim() && it.qty > 0 && it.unitPrice >= 0);
  }, [billTo, invoiceNo, items]);

  const addItem = () =>
    setItems((prev) => [...prev, { id: crypto.randomUUID(), name: "", qty: 1, unitPrice: 0 }]);

  const removeItem = (id: string) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)));

  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 将来の実装ポイント：
    // - supabase.from('invoices').insert({...})
    // - invoice_lines に items を展開して insert
    // - PDF 作成 or メール送付の Edge Function 呼び出し
    console.log("[CreateInvoice] payload", {
      invoiceNo, billTo, currency, taxRate, items, subTotal, tax, total, notes,
    });
    alert("This is a placeholder page. Submission captured in console.");
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create invoice</h1>
        <Link to="/dashboard" className="text-sm underline text-muted-foreground">
          Back to Dashboard
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Invoice No.</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Currency</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option>USD</option>
              <option>JPY</option>
              <option>EUR</option>
              <option>PHP</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Tax rate (%)</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="number"
              step="1"
              min={0}
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">Bill To</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={3}
            value={billTo}
            onChange={(e) => setBillTo(e.target.value)}
            placeholder={"Company / Person\nAddress\nEmail"}
            required
          />
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
                  className="text-sm underline"
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

          <div className="border rounded p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="font-mono">{subTotal.toFixed(2)} {currency}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tax</span>
              <span className="font-mono">{tax.toFixed(2)} {currency}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-mono font-semibold">{total.toFixed(2)} {currency}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!valid}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
          >
            Save draft
          </button>
          <button
            type="button"
            className="border px-4 py-2 rounded"
            onClick={() => alert("Share link would be generated here.")}
          >
            Share
          </button>
        </div>
      </form>
    </div>
  );
}

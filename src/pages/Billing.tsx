import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Company {
  id: string;
  name: string;
  address?: string;
  country?: string;
  email?: string;
}

interface Client {
  id: string;
  name: string;
  address?: string;
  country?: string;
  email?: string;
}

interface InvoiceItem {
  description: string;
  amount: number;
  currency: string;
}

export default function Billing() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [taxRate, setTaxRate] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", amount: 0, currency: "USD" },
  ]);
  const [loading, setLoading] = useState(false);

  // 初期ロード: companies / clients + 次の請求書番号
  useEffect(() => {
    const fetchData = async () => {
      const { data: comp } = await supabase.from("companies").select("*");
      const { data: cli } = await supabase.from("clients").select("*");
      if (comp) setCompanies(comp);
      if (cli) setClients(cli);

      await generateNextInvoiceNumber();
    };
    fetchData();
  }, []);

  // 次の請求書番号を生成
  const generateNextInvoiceNumber = async () => {
    const year = new Date().getFullYear();

    const { data, error } = await supabase
      .from("invoices")
      .select("invoice_number")
      .ilike("invoice_number", `INV-${year}-%`)
      .order("invoice_number", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Failed to fetch last invoice:", error);
      setInvoiceNumber(`INV-${year}-001`);
      return;
    }

    if (data && data.length > 0) {
      const last = data[0].invoice_number as string;
      const match = last.match(/INV-(\d+)-(\d+)/);
      if (match) {
        const seq = parseInt(match[2], 10) + 1;
        setInvoiceNumber(`INV-${year}-${String(seq).padStart(3, "0")}`);
        return;
      }
    }

    // データがない場合は初期値
    setInvoiceNumber(`INV-${year}-001`);
  };

  const saveCompany = async (company: Partial<Company>) => {
    const { data, error } = await supabase
      .from("companies")
      .insert(company)
      .select();
    if (!error && data) setCompanies((prev) => [...prev, ...data]);
  };

  const saveClient = async (client: Partial<Client>) => {
    const { data, error } = await supabase
      .from("clients")
      .insert(client)
      .select();
    if (!error && data) setClients((prev) => [...prev, ...data]);
  };

  const saveInvoice = async () => {
    if (!selectedCompany || !selectedClient || items.length === 0) {
      alert("Company, Client and at least 1 item are required");
      return;
    }
    setLoading(true);

    const total = items.reduce((sum, i) => sum + i.amount, 0);
    const company = companies.find((c) => c.id === selectedCompany);
    const client = clients.find((c) => c.id === selectedClient);

    const { error } = await supabase.from("invoices").insert({
      company_id: selectedCompany,
      client_id: selectedClient,
      customer_name: client?.name || "",
      total_amount: total,
      currency: items[0].currency,
      items: items,
      invoice_number: invoiceNumber,
      issue_date: issueDate || new Date().toISOString().slice(0, 10),
      due_date: dueDate || null,
      notes,
      tax_rate: taxRate,
      company_address: company?.address || "",
      billing_address: client?.address || "",
    });

    setLoading(false);
    if (error) {
      console.error(error);
      alert("Failed to save invoice");
    } else {
      alert(`Invoice ${invoiceNumber} saved!`);
      await generateNextInvoiceNumber(); // 次番号に更新
    }
  };

  const updateItem = (index: number, key: keyof InvoiceItem, value: any) => {
    const updated = [...items];
    updated[index][key] = value;
    setItems(updated);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Create Invoice</h1>

      {/* Invoice Metadata */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-semibold mb-1">Invoice Number</label>
          <input
            type="text"
            className="border p-2 w-full bg-gray-100"
            value={invoiceNumber}
            readOnly
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Issue Date</label>
          <input
            type="date"
            className="border p-2 w-full"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Due Date</label>
          <input
            type="date"
            className="border p-2 w-full"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Tax Rate (%)</label>
          <input
            type="number"
            className="border p-2 w-full"
            value={taxRate}
            onChange={(e) => setTaxRate(parseFloat(e.target.value))}
            placeholder="0"
          />
        </div>
      </div>

      {/* Company */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">Your Company</label>
        <select
          className="border rounded p-2 w-full mb-2"
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
        >
          <option value="">-- Select Company --</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          className="bg-blue-500 text-white px-3 py-1 rounded"
          onClick={() =>
            saveCompany({
              name: prompt("Company name?") || "",
              email: prompt("Email?") || "",
              address: prompt("Address?") || "",
            })
          }
        >
          + Add Company
        </button>
      </div>

      {/* Client */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">Your Client</label>
        <select
          className="border rounded p-2 w-full mb-2"
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
        >
          <option value="">-- Select Client --</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          className="bg-blue-500 text-white px-3 py-1 rounded"
          onClick={() =>
            saveClient({
              name: prompt("Client name?") || "",
              email: prompt("Email?") || "",
              address: prompt("Address?") || "",
            })
          }
        >
          + Add Client
        </button>
      </div>

      {/* Items */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">Items</label>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Description"
              className="border p-2 flex-1"
              value={item.description}
              onChange={(e) => updateItem(idx, "description", e.target.value)}
            />
            <input
              type="number"
              placeholder="Amount"
              className="border p-2 w-24"
              value={item.amount}
              onChange={(e) =>
                updateItem(idx, "amount", parseFloat(e.target.value))
              }
            />
            <select
              className="border p-2 w-24"
              value={item.currency}
              onChange={(e) => updateItem(idx, "currency", e.target.value)}
            >
              <option>USD</option>
              <option>JPY</option>
              <option>EUR</option>
            </select>
          </div>
        ))}
        <button
          className="bg-gray-500 text-white px-3 py-1 rounded"
          onClick={() =>
            setItems([
              ...items,
              { description: "", amount: 0, currency: "USD" },
            ])
          }
        >
          + Add Item
        </button>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block font-semibold mb-1">Notes</label>
        <textarea
          className="border p-2 w-full"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional information, payment terms, etc."
        />
      </div>

      <button
        className="bg-green-600 text-white px-4 py-2 rounded"
        onClick={saveInvoice}
        disabled={loading}
      >
        {loading ? "Saving..." : "Save Invoice"}
      </button>
    </div>
  );
}

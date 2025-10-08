// src/pages/Billing.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

interface Company {
  name: string;
  address: string;
  tax_id?: string;
}

interface Client {
  name: string;
  address: string;
  email?: string;
}

interface Invoice {
  id: number;
  company_name: string;
  company_address: string;
  client_name: string;
  client_address: string;
  client_email?: string;
  item: string;
  amount: number;
  currency: string;
  created_at?: string;
}

export default function Billing() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");

  const [companyForm, setCompanyForm] = useState<Company>({
    name: "",
    address: "",
    tax_id: "",
  });
  const [clientForm, setClientForm] = useState<Client>({
    name: "",
    address: "",
    email: "",
  });

  const [item, setItem] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState("USD");

  const [msg, setMsg] = useState<string | null>(null);
  const [pendingClientSave, setPendingClientSave] = useState<Client | null>(null);

  // 初回ロードで候補と請求書を取得
  useEffect(() => {
    const loadData = async () => {
      const { data: companyData } = await supabase.from("companies").select("*");
      if (companyData) setCompanies(companyData);

      const { data: clientData } = await supabase.from("clients").select("*");
      if (clientData) setClients(clientData);

      const { data: invoiceData } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
      if (invoiceData) setInvoices(invoiceData);
    };
    loadData();
  }, []);

  // 会社保存
  const saveCompany = async () => {
    const { error } = await supabase.from("companies").insert([companyForm]);
    if (error) {
      setMsg("Failed to save company: " + error.message);
    } else {
      setMsg("Company saved successfully");
      setCompanies([...companies, companyForm]);
      setCompanyForm({ name: "", address: "", tax_id: "" });
    }
  };

  // クライアント保存
  const saveClient = async (client: Client) => {
    const { error } = await supabase.from("clients").insert([client]);
    if (error) {
      setMsg("Failed to save client: " + error.message);
    } else {
      setMsg("Client saved successfully");
      setClients([...clients, client]);
    }
  };

  // 請求書作成
  const createInvoice = async () => {
    setMsg(null);
    try {
      if (!companyForm.name || !clientForm.name || !item || !amount) {
        throw new Error("Missing required fields.");
      }
      const { data, error } = await supabase.from("invoices").insert([
        {
          company_name: companyForm.name,
          company_address: companyForm.address,
          client_name: clientForm.name,
          client_address: clientForm.address,
          client_email: clientForm.email,
          item,
          amount,
          currency,
        },
      ]).select();

      if (error) throw error;
      setMsg("Invoice created successfully.");
      if (data) setInvoices([data[0], ...invoices]);

      // 新規クライアントだった場合 → 確認表示
      const exists = clients.find(
        (cl) =>
          cl.name.toLowerCase() === clientForm.name.toLowerCase() &&
          cl.address.toLowerCase() === clientForm.address.toLowerCase()
      );
      if (!exists) {
        setPendingClientSave(clientForm);
      }

      // 入力リセット
      setItem("");
      setAmount(0);
      setCurrency("USD");
    } catch (e: any) {
      setMsg("Failed to create invoice: " + e.message);
    }
  };

  // PDF 出力
  const downloadPDF = (inv: Invoice) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Invoice", 20, 20);

    doc.setFontSize(12);
    doc.text(`Date: ${new Date(inv.created_at || "").toLocaleDateString()}`, 20, 30);

    doc.text("From:", 20, 45);
    doc.text(inv.company_name, 20, 52);
    doc.text(inv.company_address, 20, 58);

    doc.text("To:", 20, 75);
    doc.text(inv.client_name, 20, 82);
    doc.text(inv.client_address, 20, 88);
    if (inv.client_email) doc.text(inv.client_email, 20, 94);

    doc.text("Details:", 20, 115);
    doc.text(`${inv.item}`, 20, 122);
    doc.text(`${inv.amount} ${inv.currency}`, 20, 128);

    doc.save(`invoice_${inv.id}.pdf`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Billing / Invoice</h1>

      {/* Company Section */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Your Company</h2>
        <select
          className="w-full border rounded px-2 py-1"
          value={selectedCompany}
          onChange={(e) => {
            setSelectedCompany(e.target.value);
            const c = companies.find((c) => c.name === e.target.value);
            if (c) setCompanyForm(c);
          }}
        >
          <option value="">-- Select Company --</option>
          {companies.map((c, idx) => (
            <option key={idx} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Company Name"
          className="w-full border rounded px-2 py-1"
          value={companyForm.name}
          onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
        />
        <input
          placeholder="Address"
          className="w-full border rounded px-2 py-1"
          value={companyForm.address}
          onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
        />
        <input
          placeholder="Tax ID"
          className="w-full border rounded px-2 py-1"
          value={companyForm.tax_id}
          onChange={(e) => setCompanyForm({ ...companyForm, tax_id: e.target.value })}
        />
        <button
          className="bg-primary text-white px-4 py-2 rounded"
          onClick={saveCompany}
        >
          Save Company
        </button>
      </div>

      {/* Client Section */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Your Client</h2>
        <select
          className="w-full border rounded px-2 py-1"
          value={selectedClient}
          onChange={(e) => {
            setSelectedClient(e.target.value);
            const cl = clients.find((cl) => cl.name === e.target.value);
            if (cl) setClientForm(cl);
          }}
        >
          <option value="">-- Select Client --</option>
          {clients.map((cl, idx) => (
            <option key={idx} value={cl.name}>
              {cl.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Client Name"
          className="w-full border rounded px-2 py-1"
          value={clientForm.name}
          onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
        />
        <input
          placeholder="Address"
          className="w-full border rounded px-2 py-1"
          value={clientForm.address}
          onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
        />
        <input
          placeholder="Email"
          className="w-full border rounded px-2 py-1"
          value={clientForm.email}
          onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
        />
      </div>

      {/* Invoice Details */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Invoice Details</h2>
        <input
          placeholder="Item / Service"
          className="w-full border rounded px-2 py-1"
          value={item}
          onChange={(e) => setItem(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount"
          className="w-full border rounded px-2 py-1"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <select
          className="w-full border rounded px-2 py-1"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          <option value="USD">USD</option>
          <option value="ETH">ETH</option>
        </select>
        <button
          className="bg-green-600 text-white px-4 py-2 rounded"
          onClick={createInvoice}
        >
          Create Invoice
        </button>
      </div>

      {msg && <div className="text-sm text-blue-600">{msg}</div>}

      {/* 新規クライアント保存確認 */}
      {pendingClientSave && (
        <div className="border rounded-lg p-4 bg-yellow-50 mt-4 space-y-3">
          <div className="font-semibold">Save this new client for future use?</div>
          <div className="text-sm">
            {pendingClientSave.name} ({pendingClientSave.address})
          </div>
          <div className="flex gap-2">
            <button
              className="bg-blue-600 text-white px-3 py-1 rounded"
              onClick={() => {
                saveClient(pendingClientSave);
                setPendingClientSave(null);
              }}
            >
              Yes, Save
            </button>
            <button
              className="border px-3 py-1 rounded"
              onClick={() => setPendingClientSave(null)}
            >
              No, Skip
            </button>
          </div>
        </div>
      )}

      {/* Invoice List */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Invoice History</h2>
        {invoices.length === 0 && <div>No invoices yet.</div>}
        <ul className="space-y-2">
          {invoices.map((inv) => (
            <li key={inv.id} className="border rounded p-3 flex justify-between items-center">
              <div>
                <div className="font-semibold">{inv.item}</div>
                <div className="text-sm text-gray-600">
                  {inv.client_name} — {inv.amount} {inv.currency}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(inv.created_at || "").toLocaleString()}
                </div>
              </div>
              <button
                className="bg-indigo-600 text-white px-3 py-1 rounded"
                onClick={() => downloadPDF(inv)}
              >
                Download PDF
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

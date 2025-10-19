// src/pages/invoice/InvoiceEditor.tsx
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Company = { id: string; name: string; email?: string; address?: string; tax_id?: string };
type Client  = { id: string; name: string; email?: string; address?: string };
type Item    = { desc: string; qty: number; unit_price: number };
type Wallet  = { address: string };

export default function InvoiceEditor() {
  const { user } = useAuth();

  // Your company
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cAddr, setCAddr] = useState(""); // postal address
  const [cTaxId, setCTaxId] = useState("");
  const [companyWallets, setCompanyWallets] = useState<Wallet[]>([]);
  const [companyWalletAddress, setCompanyWalletAddress] = useState<string>(""); // ✅ 連携ウォレットから選択

  // Your client
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [clName, setClName] = useState("");
  const [clEmail, setClEmail] = useState("");
  const [clAddr, setClAddr] = useState("");

  // Invoice meta
  const [number, setNumber] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [dueDate, setDueDate] = useState<string>(() => new Date(Date.now()+7*86400000).toISOString().slice(0,10));
  const [items, setItems] = useState<Item[]>([{ desc: "", qty: 1, unit_price: 0 }]);
  const [tax, setTax] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const subtotal = useMemo(() => items.reduce((s,i)=>s + (Number(i.qty)||0)*(Number(i.unit_price)||0), 0), [items]);
  const total    = useMemo(()=> subtotal + (Number(tax)||0), [subtotal, tax]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [{ data: cs }, { data: cls }, { data: ws }] = await Promise.all([
        supabase.from("companies" ).select("*").order("created_at", { ascending: false }),
        supabase.from("clients"   ).select("*").order("created_at", { ascending: false }),
        supabase.from("wallets"   ).select("address").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setCompanies(cs || []);
      setClients  (cls || []);
      setCompanyWallets((ws || []) as Wallet[]);
      if ((ws || []).length > 0) setCompanyWalletAddress((ws as any)[0].address);
    })();
  }, [user]);

  const pickCompany = (id: string) => {
    setCompanyId(id);
    const c = companies.find(x=>x.id===id);
    if (c) {
      setCName (c.name||"");
      setCEmail(c.email||"");
      setCAddr (c.address||"");
      setCTaxId((c as any).tax_id||"");
    }
  };
  const pickClient = (id: string) => {
    setClientId(id);
    const c = clients.find(x=>x.id===id);
    if (c) {
      setClName (c.name||"");
      setClEmail(c.email||"");
      setClAddr (c.address||"");
    }
  };

  const saveCompany = async () => {
    if (!user || !cName.trim()) return alert("Company name is required.");
    const { data, error } = await supabase.from("companies").insert({
      user_id: user.id, name: cName, email: cEmail, address: cAddr, tax_id: cTaxId
    }).select().single();
    if (error) return alert(error.message);
    setCompanies([data as any, ...companies]);
    setCompanyId((data as any).id);
    alert("Your company saved.");
  };

  const saveClient = async () => {
    if (!user || !clName.trim()) return alert("Client name is required.");
    const { data, error } = await supabase.from("clients").insert({
      user_id: user.id, name: clName, email: clEmail, address: clAddr
    }).select().single();
    if (error) return alert(error.message);
    setClients([data as any, ...clients]);
    setClientId((data as any).id);
    alert("Client saved.");
  };

  const addRow  = ()=> setItems([...items, { desc:"", qty:1, unit_price:0 }]);
  const editRow = (i:number, patch: Partial<Item>)=>{
    const next=[...items]; next[i] = { ...next[i], ...patch }; setItems(next);
  };
  const delRow  = (i:number)=> setItems(items.filter((_,k)=>k!==i));

  const saveInvoice = async () => {
    if (!user) return;
    if (!companyId || !clientId) return alert("Select or save Your company and Your client first.");
    if (!companyWalletAddress)  return alert("Select payout wallet (Your company address).");
    const payload = {
      user_id: user.id,
      company_id: companyId,
      client_id: clientId,
      company_wallet_address: companyWalletAddress, // ✅ 保存
      number, currency, issue_date: issueDate, due_date: dueDate,
      items, subtotal, tax, total, notes
    };
    const { error } = await supabase.from("invoices").insert(payload);
    if (error) return alert(error.message);
    alert("Invoice saved.");
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create Invoice</h1>

      {/* 上段: 左右ペイン（Your company / Your client） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Your company */}
        <Card>
          <CardHeader><CardTitle>Your company</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Choose saved</Label>
              <Select value={companyId} onValueChange={pickCompany}>
                <SelectTrigger><SelectValue placeholder="Select company"/></SelectTrigger>
                <SelectContent>
                  {companies.map(c=>(
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={cName} onChange={e=>setCName(e.target.value)} placeholder="Your company name"/>
              </div>
              <div>
                <Label>Email</Label>
                <Input value={cEmail} onChange={e=>setCEmail(e.target.value)} placeholder="contact@company.com"/>
              </div>
              <div>
                <Label>Postal address</Label>
                <Textarea value={cAddr} onChange={e=>setCAddr(e.target.value)} rows={3}/>
              </div>
              <div>
                <Label>Tax ID</Label>
                <Input value={cTaxId} onChange={e=>setCTaxId(e.target.value)} placeholder="(optional)"/>
              </div>
            </div>

            {/* ✅ 連携済みウォレットから選択 */}
            <div className="space-y-2">
              <Label>Payout wallet (Your company address)</Label>
              <Select value={companyWalletAddress} onValueChange={setCompanyWalletAddress}>
                <SelectTrigger><SelectValue placeholder="Select wallet"/></SelectTrigger>
                <SelectContent>
                  {companyWallets.map(w=>(
                    <SelectItem key={w.address} value={w.address}>{w.address}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!companyWallets.length && (
                <div className="text-xs text-muted-foreground">
                  No linked wallets. Please link a wallet on the Wallets page.
                </div>
              )}
            </div>

            <Button onClick={saveCompany}>Save company</Button>
          </CardContent>
        </Card>

        {/* Your client */}
        <Card>
          <CardHeader><CardTitle>Your client</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Choose saved</Label>
              <Select value={clientId} onValueChange={pickClient}>
                <SelectTrigger><SelectValue placeholder="Select client"/></SelectTrigger>
                <SelectContent>
                  {clients.map(c=>(
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={clName} onChange={e=>setClName(e.target.value)} placeholder="Client name"/>
              </div>
              <div>
                <Label>Email</Label>
                <Input value={clEmail} onChange={e=>setClEmail(e.target.value)} placeholder="client@example.com"/>
              </div>
              <div>
                <Label>Postal address</Label>
                <Textarea value={clAddr} onChange={e=>setClAddr(e.target.value)} rows={3}/>
              </div>
            </div>

            <Button onClick={saveClient}>Save client</Button>
          </CardContent>
        </Card>
      </div>

      {/* 下段: 請求書メタ + 明細 */}
      <Card>
        <CardHeader><CardTitle>Invoice</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            <div>
              <Label>No.</Label>
              <Input value={number} onChange={e=>setNumber(e.target.value)} placeholder="INV-0001"/>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["USD","JPY","EUR","GBP"].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Issue date</Label>
              <Input type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <Label>Items</Label>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 w-[50%]">Description</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Unit price</th>
                    <th className="text-right py-2">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i)=>(
                    <tr key={i} className="border-b">
                      <td className="py-2">
                        <Input value={it.desc} onChange={e=>editRow(i,{desc:e.target.value})} placeholder="Item description"/>
                      </td>
                      <td className="py-2 text-right">
                        <Input type="number" value={it.qty} onChange={e=>editRow(i,{qty:Number(e.target.value)})}/>
                      </td>
                      <td className="py-2 text-right">
                        <Input type="number" value={it.unit_price} onChange={e=>editRow(i,{unit_price:Number(e.target.value)})}/>
                      </td>
                      <td className="py-2 text-right">{((it.qty||0)*(it.unit_price||0)).toLocaleString()}</td>
                      <td className="py-2 text-right">
                        <Button variant="ghost" onClick={()=>delRow(i)}>Del</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" onClick={()=>setItems([...items, { desc:"", qty:1, unit_price:0 }])}>+ Add item</Button>
          </div>

          {/* totals */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div />
            <div />
            <div className="space-y-2">
              <div className="flex justify-between"><span>Subtotal</span><span>{subtotal.toLocaleString()} {currency}</span></div>
              <div className="flex items-center justify-between">
                <span>Tax</span>
                <Input className="w-32 text-right" type="number" value={tax} onChange={e=>setTax(Number(e.target.value)||0)} />
              </div>
              <div className="flex justify-between font-semibold"><span>Total</span><span>{total.toLocaleString()} {currency}</span></div>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} />
          </div>

          <div className="flex gap-2">
            <Button onClick={saveInvoice}>Save invoice</Button>
            <Button variant="outline" disabled>Generate PDF (coming soon)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

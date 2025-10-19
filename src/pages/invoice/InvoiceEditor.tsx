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

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

type Company = { id: string; name: string; email?: string; address?: string; tax_id?: string };
type Client  = { id: string; name: string; email?: string; address?: string };
type Item    = { desc: string; qty: number; unit_price: number };
type Wallet  = { address: string };

export default function InvoiceEditor() {
  const { user } = useAuth();

  // ===== Your company =====
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [cName, setCName]   = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cAddr, setCAddr]   = useState("");
  const [cTaxId, setCTaxId] = useState("");
  const [companyWallets, setCompanyWallets] = useState<Wallet[]>([]);
  const [companyWalletAddress, setCompanyWalletAddress] = useState<string>("");

  // 保存済みフラグ
  const [companySaved, setCompanySaved] = useState(false);
  const [clientSaved, setClientSaved]   = useState(false);

  // ===== Your client =====
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [clName, setClName]   = useState("");
  const [clEmail, setClEmail] = useState("");
  const [clAddr,  setClAddr]  = useState(""); // 内部保持のみ

  // ===== Invoice meta =====
  const [number, setNumber]     = useState("");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [dueDate, setDueDate]     = useState<string>(() => new Date(Date.now()+7*86400000).toISOString().slice(0,10));
  const [items, setItems] = useState<Item[]>([{ desc: "", qty: 1, unit_price: 0 }]);
  const [tax, setTax]     = useState<number>(0);
  const [notes, setNotes] = useState("");

  // メール送信
  const [emailTo, setEmailTo] = useState<string>("");
  const [sending, setSending] = useState(false);

  // 保存前確認
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  // 画面内メッセージ（例外でツリーが落ちないようにUIに集約）
  const [uiMessage, setUiMessage] = useState<string>("");

  const subtotal = useMemo(() => items.reduce((s,i)=>s + (Number(i.qty)||0)*(Number(i.unit_price)||0), 0), [items]);
  const total    = useMemo(()=> subtotal + (Number(tax)||0), [subtotal, tax]);

  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const [{ data: cs, error: e1 }, { data: cls, error: e2 }, { data: ws, error: e3 }] = await Promise.all([
          supabase.from("companies" ).select("*").order("created_at", { ascending: false }),
          supabase.from("clients"   ).select("*").order("created_at", { ascending: false }),
          supabase.from("wallets"   ).select("address").eq("user_id", user.id).order("created_at", { ascending: false }),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        if (e3) throw e3;
        setCompanies(cs || []);
        setClients  (cls || []);
        setCompanyWallets((ws || []) as Wallet[]);
        if ((ws || []).length > 0) setCompanyWalletAddress((ws as any)[0].address);
      } catch (err: any) {
        setUiMessage(`Failed to load master data: ${err?.message || String(err)}`);
      }
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
      setCompanySaved(true);
    }
  };
  const pickClient = (id: string) => {
    setClientId(id);
    const c = clients.find(x=>x.id===id);
    if (c) {
      setClName (c.name||"");
      setClEmail(c.email||"");
      setClAddr (c.address||"");
      setClientSaved(true);
    }
  };

  const saveCompany = async () => {
    try {
      if (!user || !cName.trim()) return alert("Company name is required.");
      const { data, error } = await supabase.from("companies").insert({
        user_id: user.id, name: cName, email: cEmail, address: cAddr, tax_id: cTaxId
      }).select().single();
      if (error) throw error;
      setCompanies([data as any, ...companies]);
      setCompanyId((data as any).id);
      setCompanySaved(true);
      alert("Your company saved.");
    } catch (err: any) {
      alert(err?.message || String(err));
    }
  };

  const saveClient = async () => {
    try {
      if (!user || !clName.trim()) return alert("Client name is required.");
      const { data, error } = await supabase.from("clients").insert({
        user_id: user.id, name: clName, email: clEmail, address: clAddr || null
      }).select().single();
      if (error) throw error;
      setClients([data as any, ...clients]);
      setClientId((data as any).id);
      setClientSaved(true);
      alert("Client saved.");
    } catch (err: any) {
      alert(err?.message || String(err));
    }
  };

  const addRow  = ()=> setItems([...items, { desc:"", qty:1, unit_price:0 }]);
  const editRow = (i:number, patch: Partial<Item>)=>{
    const next=[...items]; next[i] = { ...next[i], ...patch }; setItems(next);
  };

  // 実際の保存ロジック（DB 未整備でも落ちない）
  const performSaveInvoice = async () => {
    try {
      if (!user) return;
      if (!companyId || !clientId) return alert("Select or save Your company and Your client first.");
      if (!companyWalletAddress)  return alert("Select payout wallet (Your company address).");

      const payload = {
        user_id: user.id,
        company_id: companyId,
        client_id: clientId,
        company_wallet_address: companyWalletAddress,
        number, currency, issue_date: issueDate, due_date: dueDate,
        items, subtotal, tax, total, notes
      };

      const { error } = await supabase.from("invoices").insert(payload);
      if (error) {
        // スキーマ未整備の代表的エラーを UI に出す（落とさない）
        if (error.code === "42P01") {
          setUiMessage("Table 'invoices' not found. Please run the minimal SQL to create/alter it.");
        } else if (String(error.message || "").includes("column") && String(error.message || "").includes("does not exist")) {
          setUiMessage(`Missing column in 'invoices'. Please add required columns (e.g. number/items). Detail: ${error.message}`);
        }
        throw error;
      }
      alert("Invoice saved.");
    } catch (err: any) {
      // ここで終了（例外でコンポーネントを壊さない）
      console.error("[save invoice]", err);
    }
  };

  const handleSaveInvoice = () => {
    const needConfirm = (!companySaved || !clientSaved);
    if (needConfirm) {
      setPendingSave(true);
      setConfirmOpen(true);
    } else {
      performSaveInvoice();
    }
  };

  // ===== PDF 生成は遅延 import（プレビュー白画面対策） =====
  const buildDocDefinition = () => {
    const lineRows = items.map((it, i) => ([
      { text: it.desc || `Item ${i+1}`, alignment: "left" },
      { text: String(it.qty || 0), alignment: "right" },
      { text: (it.unit_price || 0).toLocaleString(), alignment: "right" },
      { text: ((it.qty||0)*(it.unit_price||0)).toLocaleString(), alignment: "right" },
    ]));

    return {
      content: [
        { text: "Invoice", style: "h1", margin: [0, 0, 0, 8] },
        { columns: [
          [
            { text: "Your company", style: "h2" },
            { text: cName || "-", bold: true },
            cEmail ? { text: cEmail } : {},
            cAddr  ? { text: cAddr }  : {},
            cTaxId ? { text: `Tax ID: ${cTaxId}` } : {},
            companyWalletAddress ? { text: `Wallet: ${companyWalletAddress}` } : {},
          ],
          [
            { text: "Bill to", style: "h2", alignment: "right" },
            { text: clName || "-", bold: true, alignment: "right" },
            clEmail ? { text: clEmail, alignment: "right" } : {},
          ]
        ], margin: [0, 0, 0, 14] },
        {
          columns: [
            [
              { text: `Invoice No.: ${number || "-"}` },
              { text: `Currency: ${currency}` },
            ],
            [
              { text: `Issue date: ${issueDate}` , alignment: "right" },
              { text: `Due date: ${dueDate}`     , alignment: "right" },
            ],
          ], margin: [0, 0, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ["*", 60, 80, 90],
            body: [
              [
                { text: "Description", bold: true },
                { text: "Qty", bold: true, alignment: "right" },
                { text: "Unit", bold: true, alignment: "right" },
                { text: "Amount", bold: true, alignment: "right" },
              ],
              ...lineRows
            ]
          }
        },
        {
          columns: [
            [{ text: notes ? `Notes:\n${notes}` : "", margin: [0, 10, 0, 0] }],
            [
              { text: `Subtotal: ${subtotal.toLocaleString()} ${currency}`, alignment: "right", margin: [0,10,0,0] },
              { text: `Tax: ${tax.toLocaleString()} ${currency}`, alignment: "right" },
              { text: `Total: ${total.toLocaleString()} ${currency}`, alignment: "right", bold: true }
            ]
          ]
        }
      ],
      styles: {
        h1: { fontSize: 20, bold: true },
        h2: { fontSize: 12, bold: true, margin: [0, 0, 0, 4] },
      },
    };
  };

  const downloadPdf = async () => {
    try {
      const pdfmake = await import("pdfmake/build/pdfmake");
      const pdfFonts = await import("pdfmake/build/vfs_fonts");
      (pdfmake as any).default.vfs = (pdfFonts as any).default.pdfMake.vfs;

      const doc = buildDocDefinition();
      (pdfmake as any).default.createPdf(doc).download("invoice.pdf");
    } catch (err: any) {
      setUiMessage(`PDF generation failed: ${err?.message || String(err)}`);
    }
  };

  const sendEmail = async () => {
    if (!emailTo || !emailTo.includes("@")) {
      return alert("Enter a valid recipient email.");
    }
    setSending(true);
    try {
      const pdfmake = await import("pdfmake/build/pdfmake");
      const pdfFonts = await import("pdfmake/build/vfs_fonts");
      (pdfmake as any).default.vfs = (pdfFonts as any).default.pdfMake.vfs;

      const doc = buildDocDefinition();
      (pdfmake as any).default.createPdf(doc).getBase64(async (base64: string) => {
        try {
          const { error } = await supabase.functions.invoke("send-invoice-email", {
            method: "POST",
            body: {
              to: emailTo,
              filename: `invoice-${number || "untitled"}.pdf`,
              pdfBase64: base64,
              subject: "Invoice",
              text: "Please find attached your invoice.",
            }
          });
          if (error) {
            setUiMessage(`Email send failed: ${error.message || String(error)}`);
            alert("Failed to send email.");
          } else {
            alert("Email sent.");
          }
        } catch (e: any) {
          setUiMessage(`Email invoke error: ${e?.message || String(e)}`);
        } finally {
          setSending(false);
        }
      });
    } catch (err: any) {
      setSending(false);
      setUiMessage(`PDF build failed: ${err?.message || String(err)}`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create Invoice</h1>

      {!!uiMessage && (
        <div className="text-sm p-3 rounded bg-yellow-50 border border-yellow-200 text-yellow-900">
          {uiMessage}
        </div>
      )}

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
                <Input value={cName} onChange={e=>{ setCName(e.target.value); setCompanySaved(false); }} placeholder="Your company name"/>
              </div>
              <div>
                <Label>Email</Label>
                <Input value={cEmail} onChange={e=>{ setCEmail(e.target.value); setCompanySaved(false); }} placeholder="contact@company.com"/>
              </div>
              <div>
                <Label>Postal address</Label>
                <Textarea value={cAddr} onChange={e=>{ setCAddr(e.target.value); setCompanySaved(false); }} rows={3}/>
              </div>
              <div>
                <Label>Tax ID</Label>
                <Input value={cTaxId} onChange={e=>{ setCTaxId(e.target.value); setCompanySaved(false); }} placeholder="(optional)"/>
              </div>
            </div>

            {/* 連携済みウォレットから選択 */}
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

            <div className="flex items-center gap-3">
              <Button onClick={saveCompany}>Save company</Button>
              <span className={`text-xs ${companySaved ? "text-green-600" : "text-muted-foreground"}`}>
                {companySaved ? "Saved" : "Not saved"}
              </span>
            </div>
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
                <Input value={clName} onChange={e=>{ setClName(e.target.value); setClientSaved(false); }} placeholder="Client name"/>
              </div>
              <div>
                <Label>Email</Label>
                <Input value={clEmail} onChange={e=>{ setClEmail(e.target.value); setClientSaved(false); }} placeholder="client@example.com"/>
              </div>
              {/* Postal address 入力は UI 非表示（clAddr は保持） */}
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={saveClient}>Save client</Button>
              <span className={`text-xs ${clientSaved ? "text-green-600" : "text-muted-foreground"}`}>
                {clientSaved ? "Saved" : "Not saved"}
              </span>
            </div>
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
                        <Button variant="ghost" onClick={()=>setItems(items.filter((_,k)=>k!==i))}>Del</Button>
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

          {/* Email 送信先 & PDF */}
          <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <Label>Send to (email)</Label>
              <Input placeholder="client@example.com" value={emailTo} onChange={e=>setEmailTo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadPdf}>Download PDF</Button>
              <Button onClick={sendEmail} disabled={sending}>{sending ? "Sending..." : "Send Email"}</Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveInvoice}>Save invoice</Button>
          </div>
        </CardContent>
      </Card>

      {/* 保存前確認モーダル */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>未保存の情報があります</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            会社またはクライアント情報が保存されていません。請求書の保存を続けますか？
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={()=>{ setPendingSave(false); }}>いいえ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                if (pendingSave) {
                  setPendingSave(false);
                  performSaveInvoice();
                }
              }}
            >
              はい
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

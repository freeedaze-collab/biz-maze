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

// 確認モーダル（shadcn/ui）
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

// pdfmake（まずは標準フォントで動作）
// 日本語フォント対応は vfs を差し替えればOK（後述）
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
pdfMake.vfs = pdfFonts.pdfMake.vfs;

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
  const [cAddr, setCAddr]   = useState(""); // postal address
  const [cTaxId, setCTaxId] = useState("");
  const [companyWallets, setCompanyWallets] = useState<Wallet[]>([]);
  const [companyWalletAddress, setCompanyWalletAddress] = useState<string>("");

  // 会社・クライアント「保存済み」フラグ
  const [companySaved, setCompanySaved] = useState(false);
  const [clientSaved, setClientSaved]   = useState(false);

  // ===== Your client（UIから address 入力は削除。型は温存） =====
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [clName, setClName]   = useState("");
  const [clEmail, setClEmail] = useState("");
  const [clAddr, setClAddr]   = useState(""); // 選択時ロード分は内部で保持

  // ===== Invoice meta =====
  const [number, setNumber]     = useState("");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [dueDate, setDueDate]     = useState<string>(() => new Date(Date.now()+7*86400000).toISOString().slice(0,10));
  const [items, setItems] = useState<Item[]>([{ desc: "", qty: 1, unit_price: 0 }]);
  const [tax, setTax]     = useState<number>(0);
  const [notes, setNotes] = useState("");

  // ===== Email 送信（PDF添付） =====
  const [emailTo, setEmailTo]   = useState<string>("");
  const [sending, setSending]   = useState(false);

  // ===== Save Invoice 前の確認モーダル =====
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(false); // 「はい」選択時に保存を続行

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
      setCompanySaved(true); // 保存済みの選択と見なす
    }
  };
  const pickClient = (id: string) => {
    setClientId(id);
    const c = clients.find(x=>x.id===id);
    if (c) {
      setClName (c.name||"");
      setClEmail(c.email||"");
      setClAddr (c.address||"");
      setClientSaved(true); // 保存済みの選択と見なす
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
    setCompanySaved(true);
    alert("Your company saved.");
  };

  const saveClient = async () => {
    if (!user || !clName.trim()) return alert("Client name is required.");
    const { data, error } = await supabase.from("clients").insert({
      user_id: user.id, name: clName, email: clEmail, address: clAddr || null
    }).select().single();
    if (error) return alert(error.message);
    setClients([data as any, ...clients]);
    setClientId((data as any).id);
    setClientSaved(true);
    alert("Client saved.");
  };

  const addRow  = ()=> setItems([...items, { desc:"", qty:1, unit_price:0 }]);
  const editRow = (i:number, patch: Partial<Item>)=>{
    const next=[...items]; next[i] = { ...next[i], ...patch }; setItems(next);
  };
  const delRow  = (i:number)=> setItems(items.filter((_,k)=>k!==i));

  // ===== 実際の保存ロジック =====
  const performSaveInvoice = async () => {
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
    if (error) return alert(error.message);
    alert("Invoice saved.");
  };

  // ===== Save Invoice（前処理：未保存チェック → モーダル） =====
  const handleSaveInvoice = () => {
    const needConfirm = (!companySaved || !clientSaved);
    if (needConfirm) {
      setPendingSave(true);
      setConfirmOpen(true);
    } else {
      performSaveInvoice();
    }
  };

  // ===== PDF: docDefinition を現在のフォーム値から生成 =====
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
      // 日本語フォント対応は後で vfs 差し替え時に:
      // defaultStyle: { font: 'NotoSansJP' }
    };
  };

  const downloadPdf = () => {
    const doc = buildDocDefinition();
    pdfMake.createPdf(doc).download("invoice.pdf");
  };

  const sendEmail = async () => {
    if (!emailTo || !emailTo.includes("@")) {
      alert("Enter a valid recipient email.");
      return;
    }
    setSending(true);
    try {
      const doc = buildDocDefinition();
      // Base64 取得 → Edge Function へ
      pdfMake.createPdf(doc).getBase64(async (base64: string) => {
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
          alert("Failed to send email: " + (error.message || String(error)));
        } else {
          alert("Email sent.");
        }
        setSending(false);
      });
    } catch (e: any) {
      setSending(false);
      alert("Failed: " + (e?.message || String(e)));
    }
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

        {/* Your client（住所入力は削除） */}
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
              {/* Postal address は UI から外す（項目は温存） */}
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

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} />
          </div>

          {/* Email 送信先 */}
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

      {/* 確認モーダル */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>未保存の情報があります</AlertDialogTitle>
            <AlertDialogDescription>
              会社またはクライアント情報が保存されていません。請求書の保存を続けますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
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

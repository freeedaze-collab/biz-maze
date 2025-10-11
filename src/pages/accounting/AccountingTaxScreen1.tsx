// src/pages/accounting/AccountingTaxScreen1.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Json = any;

export default function AccountingTaxScreen1() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const [basic, setBasic] = useState<Json | null>(null);
  const [us, setUs] = useState<Json | null>(null);
  const [ifrs, setIfrs] = useState<Json | null>(null);

  const authHeader = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const call = async (url: string, init?: RequestInit) => {
    const headers = {
      ...(await authHeader()),
      ...(init?.headers || {}),
    } as Record<string, string>;
    const res = await fetch(url, { ...init, headers });
    let json: any = null;
    try { json = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      const msg = json?.error || res.statusText || "Request failed";
      throw new Error(msg);
    }
    return json;
  };

  const genJE = async () => {
    setBusy(true); setLog("Generating journal entries...");
    try {
      const r = await call("/functions/v1/generate-journal-entries", { method: "POST" });
      setLog(`Generated rows: ${r?.inserted ?? 0}`);
    } catch (e: any) {
      setLog(`Error: ${String(e.message || e)}`);
    } finally { setBusy(false); }
  };

  const calcBasic = async () => {
    setBusy(true); setLog("Calculating (MVP)...");
    try {
      const r = await call("/functions/v1/calculate-taxable-income?fx=150");
      setBasic(r);
      setLog("Done.");
    } catch (e: any) {
      setLog(`Error: ${String(e.message || e)}`);
    } finally { setBusy(false); }
  };

  const calcUs = async () => {
    setBusy(true); setLog("Estimating US federal tax...");
    try {
      const r = await call("/functions/v1/calculate-us-tax");
      setUs(r);
      setLog("Done.");
    } catch (e: any) {
      setLog(`Error: ${String(e.message || e)}`);
    } finally { setBusy(false); }
  };

  const genIFRS = async () => {
    setBusy(true); setLog("Generating IFRS report...");
    try {
      const r = await call("/functions/v1/generate-ifrs-report");
      setIfrs(r);
      setLog("Done.");
    } catch (e: any) {
      setLog(`Error: ${String(e.message || e)}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Accounting / Tax</h1>

      <Card>
        <CardHeader><CardTitle>Automation</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button onClick={genJE} disabled={busy}>Generate Journal Entries</Button>
            <Button onClick={calcBasic} variant="outline" disabled={busy}>Calculate (MVP)</Button>
            <Button onClick={calcUs} variant="outline" disabled={busy}>Estimate US Tax</Button>
            <Button onClick={genIFRS} variant="outline" disabled={busy}>Generate IFRS Report</Button>
          </div>
          <div className="text-sm">{log}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>MVP Summary</CardTitle></CardHeader>
        <CardContent><pre className="text-xs overflow-auto">{JSON.stringify(basic ?? { ok: false }, null, 2)}</pre></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>US Federal Estimate</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto">{JSON.stringify(us ?? { ok: false }, null, 2)}</pre>
          <div className="mt-2 text-xs text-muted-foreground">* Rough estimate only. Not tax advice.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>IFRS (Trial Balance / P&L)</CardTitle></CardHeader>
        <CardContent><pre className="text-xs overflow-auto">{JSON.stringify(ifrs ?? { ok: false }, null, 2)}</pre></CardContent>
      </Card>
    </div>
  );
}

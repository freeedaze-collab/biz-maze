// src/pages/accounting/AccountingTaxScreen1.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Json = any;

type BasicSummary = {
  country?: "US" | "JP";
  entity_type?: "personal" | "corporate";
  income_usd?: number;
  expense_usd?: number;
  taxable_income_usd?: number;
  fx_used?: number;
  taxable_income_jpy?: number;
};

type UsTaxResult = {
  ok?: boolean;
  entity_type?: "personal" | "corporate";
  income_usd?: number;
  expense_usd?: number;
  taxable_income_usd?: number;
  taxable_after_deduction_usd?: number;
  estimated_federal_tax_usd?: number;
  notes?: string;
};

type IfrsResult = {
  ok?: boolean;
  pl?: { revenue_usd?: number; expense_usd?: number; profit_usd?: number };
  trial_balance?: Array<{ account: string; debit: number; credit: number }>;
};

export default function AccountingTaxScreen1() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");

  const [inserted, setInserted] = useState<number | null>(null);

  const [basic, setBasic] = useState<BasicSummary | null>(null);
  const [basicAt, setBasicAt] = useState<string | null>(null);

  const [us, setUs] = useState<UsTaxResult | null>(null);
  const [usAt, setUsAt] = useState<string | null>(null);

  const [ifrs, setIfrs] = useState<IfrsResult | null>(null);
  const [ifrsAt, setIfrsAt] = useState<string | null>(null);

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
    try {
      json = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok || json?.ok === false) {
      // Edge Function は 200 + {ok:false,error} を返すこともあるため併用で判定
      const msg = json?.error || res.statusText || "Request failed";
      throw new Error(msg);
    }
    return json;
  };

  const genJE = async () => {
    setBusy(true);
    setLog("Generating journal entries...");
    setInserted(null);
    try {
      const r = await call("/functions/v1/generate-journal-entries", { method: "POST" });
      // 期待: { ok:true, inserted:n }
      setInserted(Number(r?.inserted ?? 0));
      setLog(`Generated rows: ${r?.inserted ?? 0}`);
    } catch (e: any) {
      setLog(`Error: ${String(e.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const calcBasic = async () => {
    setBusy(true);
    setLog("Calculating (MVP)...");
    try {
      const r = await call("/functions/v1/calculate-taxable-income?fx=150");
      // 期待: { ok:true, summary:{...} }
      setBasic(r?.summary ?? null);
      setBasicAt(new Date().toISOString());
      setLog("Done.");
    } catch (e: any) {
      setLog(`Error: ${String(e.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const calcUs = async () => {
    setBusy(true);
    setLog("Estimating US federal tax...");
    try {
      const r = await call("/functions/v1/calculate-us-tax");
      setUs(r ?? null);
      setUsAt(new Date().toISOString());
      setLog("Done.");
    } catch (e: any) {
      setLog(`Error: ${String(e.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const genIFRS = async () => {
    setBusy(true);
    setLog("Generating IFRS report...");
    try {
      const r = await call("/functions/v1/generate-ifrs-report");
      setIfrs(r ?? null);
      setIfrsAt(new Date().toISOString());
      setLog("Done.");
    } catch (e: any) {
      setLog(`Error: ${String(e.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const cur = (n?: number) =>
    typeof n === "number" ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "-";
  const jpy = (n?: number) =>
    typeof n === "number" ? `${n.toLocaleString()} JPY` : "-";

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Accounting / Tax</h1>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={genJE} disabled={busy}>
              Generate Journal Entries
            </Button>
            <Button onClick={calcBasic} variant="outline" disabled={busy}>
              Calculate (MVP)
            </Button>
            <Button onClick={calcUs} variant="outline" disabled={busy}>
              Estimate US Tax
            </Button>
            <Button onClick={genIFRS} variant="outline" disabled={busy}>
              Generate IFRS Report
            </Button>
          </div>

          <div className="text-sm">
            {busy ? "Working..." : log || "Ready."}
          </div>

          {/* JE inserted count */}
          {inserted !== null && (
            <div className="text-sm text-muted-foreground">
              Inserted rows (journal_entries): <span className="font-mono">{inserted}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MVP Summary (Income/Expense/Taxable) */}
      <Card>
        <CardHeader>
          <CardTitle>MVP Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!basic ? (
            <div className="text-sm text-muted-foreground">
              No summary yet. Click <span className="font-semibold">Calculate (MVP)</span>.
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                Last updated: {basicAt ? new Date(basicAt).toLocaleString() : "-"}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Country</th>
                      <th className="text-left py-2">Entity</th>
                      <th className="text-right py-2">Income (USD)</th>
                      <th className="text-right py-2">Expense (USD)</th>
                      <th className="text-right py-2">Taxable (USD)</th>
                      <th className="text-right py-2">Taxable (JPY)</th>
                      <th className="text-right py-2">FX</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2">{basic.country ?? "-"}</td>
                      <td className="py-2">{basic.entity_type ?? "-"}</td>
                      <td className="py-2 text-right">{cur(basic.income_usd)}</td>
                      <td className="py-2 text-right">{cur(basic.expense_usd)}</td>
                      <td className="py-2 text-right">{cur(basic.taxable_income_usd)}</td>
                      <td className="py-2 text-right">{jpy(basic.taxable_income_jpy)}</td>
                      <td className="py-2 text-right">
                        {typeof basic.fx_used === "number" ? basic.fx_used : "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* US Federal Estimate */}
      <Card>
        <CardHeader>
          <CardTitle>US Federal Tax (Estimate)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!us ? (
            <div className="text-sm text-muted-foreground">
              No estimate yet. Click <span className="font-semibold">Estimate US Tax</span>.
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                Last updated: {usAt ? new Date(usAt).toLocaleString() : "-"}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Entity</th>
                      <th className="text-right py-2">Income (USD)</th>
                      <th className="text-right py-2">Expense (USD)</th>
                      <th className="text-right py-2">Taxable Base (USD)</th>
                      <th className="text-right py-2">Taxable After Deduction</th>
                      <th className="text-right py-2">Estimated Federal Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2">{us.entity_type ?? "-"}</td>
                      <td className="py-2 text-right">{cur(us.income_usd)}</td>
                      <td className="py-2 text-right">{cur(us.expense_usd)}</td>
                      <td className="py-2 text-right">{cur(us.taxable_income_usd)}</td>
                      <td className="py-2 text-right">{cur(us.taxable_after_deduction_usd)}</td>
                      <td className="py-2 text-right">{cur(us.estimated_federal_tax_usd)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {us.notes && (
                <div className="text-xs text-muted-foreground mt-2">
                  * {us.notes}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* IFRS Report */}
      <Card>
        <CardHeader>
          <CardTitle>IFRS Report (P/L & Trial Balance)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!ifrs ? (
            <div className="text-sm text-muted-foreground">
              No IFRS report yet. Click <span className="font-semibold">Generate IFRS Report</span>.
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                Last updated: {ifrsAt ? new Date(ifrsAt).toLocaleString() : "-"}
              </div>

              {/* P/L */}
              <div>
                <div className="font-semibold mb-2">Profit & Loss</div>
                <div className="overflow-x-auto">
                  <table className="min-w-[580px] w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-right py-2">Revenue (USD)</th>
                        <th className="text-right py-2">Expense (USD)</th>
                        <th className="text-right py-2">Profit (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2 text-right">{cur(ifrs.pl?.revenue_usd)}</td>
                        <td className="py-2 text-right">{cur(ifrs.pl?.expense_usd)}</td>
                        <td className="py-2 text-right">{cur(ifrs.pl?.profit_usd)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trial Balance */}
              <div>
                <div className="font-semibold mb-2">Trial Balance</div>
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Account</th>
                        <th className="text-right py-2">Debit</th>
                        <th className="text-right py-2">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ifrs.trial_balance ?? []).map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-2">{r.account}</td>
                          <td className="py-2 text-right">{cur(r.debit)}</td>
                          <td className="py-2 text-right">{cur(r.credit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

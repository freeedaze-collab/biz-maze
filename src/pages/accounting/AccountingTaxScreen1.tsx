// src/pages/accounting/AccountingTaxScreen1.tsx
import { useMemo, useState } from "react";
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
  const [basicRaw, setBasicRaw] = useState<Json | null>(null);

  const [us, setUs] = useState<UsTaxResult | null>(null);
  const [usRaw, setUsRaw] = useState<Json | null>(null);

  const [ifrs, setIfrs] = useState<IfrsResult | null>(null);
  const [ifrsRaw, setIfrsRaw] = useState<Json | null>(null);

  const baseFnUrl = useMemo(() => {
    const u = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
    return (u ?? "").replace(/\/+$/, "") + "/functions/v1";
  }, []);
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

  const getAuthHeader = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    if (anonKey) h.apikey = anonKey; // 念のため付与（ゲートウェイで要求されることがある）
    return h;
  };

  /** Robust invoker:
   *  1) supabase.functions.invoke（任意method対応）
   *  2) 失敗時は fetch(絶対URL) にフォールバック
   *  3) 本文が空/非JSONでも rawText を返す
   */
  const invoke = async (
    name: string,
    opt?: { method?: "GET" | "POST"; query?: Record<string, string | number>; body?: Json }
  ): Promise<{ json: any; rawText: string; status: number }> => {
    const method = opt?.method ?? "POST";
    const query = opt?.query ?? {};
    const qs =
      Object.keys(query).length > 0
        ? "?" +
          Object.entries(query)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            .join("&")
        : "";

    // 1) invoke（method対応）
    try {
      const { data, error } = await supabase.functions.invoke(`${name}${qs}`, {
        method,
        body: method === "POST" ? (opt?.body ?? {}) : undefined,
        headers: await getAuthHeader(),
      });
      if (error) throw error;
      return { json: data, rawText: JSON.stringify(data), status: 200 };
    } catch (e) {
      console.warn(`[invoke] supabase.functions.invoke failed for ${name}:`, e);
    }

    // 2) fetch fallback（絶対URL + apikey + Authorization）
    const headers = { ...(await getAuthHeader()), "Content-Type": "application/json" };
    const url = `${baseFnUrl}/${name}${qs}`;
    const res = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(opt?.body ?? {}) : undefined,
    });

    const status = res.status;
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      // 非JSONでも rawText を返す
    }

    if (!res.ok || (json && json.ok === false)) {
      const msg = (json && json.error) || res.statusText || "Function call failed";
      throw new Error(`${name}: ${msg}; status=${status}; raw=${text?.slice(0, 200)}`);
    }
    return { json, rawText: text, status };
  };

  const genJE = async () => {
    setBusy(true);
    setLog("Generating journal entries...");
    setInserted(null);
    try {
      const { json } = await invoke("generate-journal-entries", { method: "POST" });
      const ins = Number((json?.inserted ?? json?.count ?? 0) as any);
      setInserted(ins);
      setLog(`Generated rows: ${ins}`);
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
      const { json, rawText } = await invoke("calculate-taxable-income", {
        method: "GET",
        query: { fx: 150 },
      });
      const summary: BasicSummary | null =
        (json?.summary as any) ??
        (("income_usd" in (json ?? {})) ? (json as any) : null);
      setBasic(summary);
      setBasicRaw(json ?? rawText);
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
      const { json, rawText } = await invoke("calculate-us-tax", { method: "GET" });
      setUs((json as any) ?? null);
      setUsRaw(json ?? rawText);
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
      const { json, rawText } = await invoke("generate-ifrs-report", { method: "GET" });
      setIfrs((json as any) ?? null);
      setIfrsRaw(json ?? rawText);
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

  const Raw = ({ obj }: { obj: any }) => (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">Raw JSON</summary>
      <pre className="text-xs overflow-auto mt-2">
        {typeof obj === "string" ? obj : JSON.stringify(obj ?? {}, null, 2)}
      </pre>
    </details>
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Accounting / Tax</h1>

      <Card>
        <CardHeader><CardTitle>Automation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={genJE} disabled={busy}>Generate Journal Entries</Button>
            <Button onClick={calcBasic} variant="outline" disabled={busy}>Calculate (MVP)</Button>
            <Button onClick={calcUs} variant="outline" disabled={busy}>Estimate US Tax</Button>
            <Button onClick={genIFRS} variant="outline" disabled={busy}>Generate IFRS Report</Button>
          </div>
          <div className="text-sm">{busy ? "Working..." : log || "Ready."}</div>
          {inserted !== null && (
            <div className="text-sm text-muted-foreground">
              Inserted rows (journal_entries): <span className="font-mono">{inserted}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MVP Summary */}
      <Card>
        <CardHeader><CardTitle>MVP Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!basic ? (
            <div className="text-sm text-muted-foreground">
              No summary yet. Click <span className="font-semibold">Calculate (MVP)</span>.
            </div>
          ) : (
            <>
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
                      <td className="py-2 text-right">{typeof basic.fx_used === "number" ? basic.fx_used : "-"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Raw obj={basicRaw} />
            </>
          )}
        </CardContent>
      </Card>

      {/* US Tax */}
      <Card>
        <CardHeader><CardTitle>US Federal Tax (Estimate)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!us ? (
            <div className="text-sm text-muted-foreground">
              No estimate yet. Click <span className="font-semibold">Estimate US Tax</span>.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Entity</th>
                      <th className="text-right py-2">Income (USD)</th>
                      <th className="text-right py-2">Expense (USD)</th>
                      <th className="text-right py-2">Taxable Base</th>
                      <th className="text-right py-2">After Deduction</th>
                      <th className="text-right py-2">Estimated Tax</th>
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
              <Raw obj={usRaw} />
            </>
          )}
        </CardContent>
      </Card>

      {/* IFRS */}
      <Card>
        <CardHeader><CardTitle>IFRS Report (P/L & Trial Balance)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!ifrs ? (
            <div className="text-sm text-muted-foreground">
              No IFRS report yet. Click <span className="font-semibold">Generate IFRS Report</span>.
            </div>
          ) : (
            <>
              <div>
                <div className="font-semibold mb-2">Profit &amp; Loss</div>
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
              <Raw obj={ifrsRaw} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

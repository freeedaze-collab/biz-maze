// src/pages/accounting/AccountingTaxScreen1.tsx
import { useEffect, useMemo, useState } from "react";
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
  const [basicRaw, setBasicRaw] = useState<Json | string | null>(null);

  const [us, setUs] = useState<UsTaxResult | null>(null);
  const [usRaw, setUsRaw] = useState<Json | string | null>(null);

  const [ifrs, setIfrs] = useState<IfrsResult | null>(null);
  const [ifrsRaw, setIfrsRaw] = useState<Json | string | null>(null);

  // ===== Debug info (可視化) =====
  const [dbg, setDbg] = useState<{url?: string; hasJWT?: boolean; jwtPrefix?: string; err?: string} | null>(null);
  const projectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const baseFnUrl = useMemo(() => (projectUrl ?? "").replace(/\/+$/, "") + "/functions/v1", [projectUrl]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      setDbg({
        url: baseFnUrl || "(VITE_SUPABASE_URL missing)",
        hasJWT: !!token,
        jwtPrefix: token ? token.slice(0, 12) + "...(len=" + token.length + ")" : "(none)",
      });
    })();
  }, [baseFnUrl]);

  // 共通: supabase.functions.invoke を使う（POST固定; GETの代わりにクエリは body に乗せる）
  // invoke は supabase-js がプロジェクトURLを内部で解決するので、相対/絶対URL問題・apikey付与問題を回避できます。
  const invoke = async (name: string, body?: any) => {
    try {
      const { data, error } = await supabase.functions.invoke(name, {
        method: "POST",            // ← GET は使わず POST に統一（関数側は GET/POST どちらでも処理する実装にしてある）
        body: body ?? {},
        headers: {
          // Authorization は supabase-js が自動で付与。なにかあれば下記を有効化:
          // ...(await authHeader())
        },
      });
      if (error) throw error;
      return data;
    } catch (e: any) {
      const msg = e?.message || JSON.stringify(e);
      setDbg((prev) => ({ ...(prev ?? {}), err: `[invoke error] ${msg}` }));
      throw e;
    }
  };

  const genJE = async () => {
    setBusy(true);
    setLog("Generating journal entries...");
    setInserted(null);
    try {
      // 仕訳生成は引数不要
      const json = await invoke("generate-journal-entries");
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
      // fx を body で渡す（関数側は GET/POST両対応にしてある）
      const json = await invoke("calculate-taxable-income", { fx: 150 });
      const summary: BasicSummary | null =
        (json?.summary as any) ??
        (("income_usd" in (json ?? {})) ? (json as any) : null);
      setBasic(summary);
      setBasicRaw(json);
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
      const json = await invoke("calculate-us-tax");
      setUs((json as any) ?? null);
      setUsRaw(json);
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
      const json = await invoke("generate-ifrs-report");
      setIfrs((json as any) ?? null);
      setIfrsRaw(json);
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

  const Raw = ({ obj, title }: { obj: any; title: string }) => (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">{title}</summary>
      <pre className="text-xs overflow-auto mt-2">
        {typeof obj === "string" ? obj : JSON.stringify(obj ?? {}, null, 2)}
      </pre>
    </details>
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Accounting / Tax</h1>

      {/* Debug Panel */}
      <Card>
        <CardHeader><CardTitle>Debug</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Supabase URL (from env): <span className="font-mono">{projectUrl || "(missing)"}</span></div>
          <div>Functions Base URL: <span className="font-mono">{dbg?.url}</span></div>
          <div>Has JWT: <span className="font-mono">{String(dbg?.hasJWT)}</span> / JWT prefix: <span className="font-mono">{dbg?.jwtPrefix}</span></div>
          <div>Anon key present: <span className="font-mono">{String(!!anon)}</span></div>
          {dbg?.err && <div className="text-red-600">Last invoke error: {dbg.err}</div>}
        </CardContent>
      </Card>

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
                      <td className="py-2 text-right">
                        {typeof basic.fx_used === "number" ? basic.fx_used : "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Raw title="Raw JSON (MVP)" obj={basicRaw} />
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
              <Raw title="Raw JSON (US Tax)" obj={usRaw} />
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
              <Raw title="Raw JSON (IFRS)" obj={ifrsRaw} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

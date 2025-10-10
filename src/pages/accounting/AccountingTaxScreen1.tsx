// src/pages/accounting/AccountingTaxScreen1.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type TaxSummary = {
  ok?: boolean;
  summary?: {
    country: "US" | "JP";
    entity_type: string;
    income_usd: number;
    expense_usd: number;
    taxable_income_usd: number;
    fx_used?: number;
    taxable_income_jpy?: number;
  };
  error?: string;
};

export default function AccountingTaxScreen1() {
  const [busy, setBusy] = useState(false);
  const [tax, setTax] = useState<TaxSummary | null>(null);
  const [log, setLog] = useState<string>("");

  const runGenerate = async () => {
    setBusy(true);
    setLog("Generating journal entries...");
    try {
      const res = await fetch("/functions/v1/generate-journal-entries", { method: "POST" });
      const json = await res.json();
      setLog(`Generated: ${json.inserted ?? 0} entries`);
    } catch (e: any) {
      setLog(`Error: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const runTax = async () => {
    setBusy(true);
    setLog("Calculating taxable income...");
    try {
      // For JP we allow fx param; US simply ignores it server-side
      const res = await fetch("/functions/v1/calculate-taxable-income?fx=150", { method: "GET" });
      const json = (await res.json()) as TaxSummary;
      setTax(json);
      setLog("Done.");
    } catch (e: any) {
      setLog(`Error: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Accounting / Tax</h1>

      <Card>
        <CardHeader><CardTitle>Automation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={runGenerate} disabled={busy}>Generate Journal Entries</Button>
            <Button onClick={runTax} variant="outline" disabled={busy}>Calculate Taxable Income</Button>
          </div>
          <div className="text-sm text-muted-foreground">{log}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Result</CardTitle></CardHeader>
        <CardContent>
          {!tax?.ok ? (
            <div className="text-sm text-muted-foreground">
              No result yet. Click “Calculate Taxable Income”.
            </div>
          ) : (
            <div className="text-sm">
              <div><b>Country:</b> {tax.summary?.country}</div>
              <div><b>Entity:</b> {tax.summary?.entity_type}</div>
              <div><b>Income (USD):</b> {tax.summary?.income_usd}</div>
              <div><b>Expense (USD):</b> {tax.summary?.expense_usd}</div>
              <div><b>Taxable Income (USD):</b> {tax.summary?.taxable_income_usd}</div>
              {tax.summary?.country === "JP" && (
                <>
                  <div><b>FX used:</b> {tax.summary?.fx_used}</div>
                  <div><b>Taxable Income (JPY):</b> {tax.summary?.taxable_income_jpy}</div>
                </>
              )}
              <div className="mt-2 text-xs text-muted-foreground">
                * MVP estimation only — not tax advice.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// @ts-nocheck
// src/pages/PaymentGateway.tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function PaymentGateway() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("profiles")
        .select("gateway_enabled")
        .eq("id", user.id)
        .maybeSingle();
      setEnabled(Boolean((data as any)?.gateway_enabled));
      setLoading(false);
    })();
  }, [user]);

  const toggle = async () => {
    if (!user) return;
    setSaving(true); setMsg("");
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, gateway_enabled: !enabled }, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      setEnabled(!enabled);
      setMsg("Updated.");
    } catch (e: any) {
      setMsg(`Failed: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Payment Gateway</h1>
      <Card>
        <CardHeader><CardTitle>準備中</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          決済連携（受取・支払・手数料計上など）は次フェーズで接続します。<br />
          まずは UI・台帳（journal_entries）までの整合性を優先して仕上げます。
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Gateway Control</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <>
              <div className="text-sm">
                Status:{" "}
                <span className={`font-semibold ${enabled ? "text-green-600" : "text-muted-foreground"}`}>
                  {enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <Button onClick={toggle} disabled={saving || !user}>
                {enabled ? "Disable" : "Enable"}
              </Button>
              {msg && <div className="text-sm text-muted-foreground">{msg}</div>}
              <div className="text-xs text-muted-foreground">
                ※ 実資金の送受は<strong>本番前に必ずSandboxで動作確認</strong>してください（Metamask/テストネット）。
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

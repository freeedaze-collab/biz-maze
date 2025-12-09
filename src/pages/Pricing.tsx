// @ts-nocheck
// src/pages/Pricing.tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Plan = {
  name: string;
  price: number;
  usageNote?: string;
  features: string[];
};

const companyPlans: Plan[] = [
  { name: "Company $100", price: 100, usageNote: undefined, features: [] },
  { name: "Company $250", price: 250, usageNote: undefined, features: [] },
  { name: "Company $500", price: 500, usageNote: undefined, features: [] },
];

const companyMetered = [
  "Remittance → $8/tx",
  "Invoice issuance → $8/tx",
  "Payment processing → $8/tx",
  "Exchange trade → $8/tx",
];

const personalPlans: Plan[] = [
  { name: "Personal $0", price: 0, usageNote: "Metered → $10/tx", features: [] },
  { name: "Personal $30", price: 30, usageNote: "Metered → $5/tx", features: [] },
  { name: "Personal $80", price: 80, usageNote: "Metered → $2/tx", features: [] },
];

const personalExtra = ["Exchange trade → $5/tx", "1-month free (metered free too)"];

export default function Pricing() {
  const [tab, setTab] = useState<"company" | "personal">("company");
  const [audience, setAudience] = useState<"personal" | "corporate" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: session } = await supabase.auth.getSession();
        const uid = session.session?.user.id;
        if (!uid) {
          setAudience(null);
          return;
        }
        const { data: prof } = await supabase
          .from("profiles")
          .select("account_type, entity_type")
          .eq("id", uid)
          .maybeSingle();

        // account_type（individual/corporate）優先。無ければ entity_type の互換値を解釈。
        const raw = (prof?.account_type || prof?.entity_type || "").toString().toLowerCase();
        const a: "personal" | "corporate" = raw.includes("corp") ? "corporate" : "personal";
        setAudience(a);
        setTab(a === "corporate" ? "company" : "personal");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const showOnlyOne = audience !== null;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pricing</h1>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : showOnlyOne ? (
        audience === "corporate" ? (
          <div className="mt-6">
            <div className="text-sm text-muted-foreground mb-4">Showing plans for <b>corporation</b> (based on your Profile).</div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {companyPlans.map((p) => (
                <Card key={p.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <Badge variant="secondary">Monthly</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">${p.price}</div>
                    <div className="text-sm text-muted-foreground">Metered</div>
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      {companyMetered.map((m) => (<li key={m}>{m}</li>))}
                    </ul>
                    <Button className="w-full" disabled>Coming soon</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <div className="text-sm text-muted-foreground mb-4">Showing plans for <b>individual</b> (based on your Profile).</div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {personalPlans.map((p) => (
                <Card key={p.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <Badge variant="secondary">Monthly</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">${p.price}</div>
                    {p.usageNote && (<div className="text-sm text-muted-foreground">{p.usageNote}</div>)}
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      {personalExtra.map((m) => (<li key={m}>{m}</li>))}
                    </ul>
                    <Button className="w-full" disabled>Coming soon</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList>
            <TabsTrigger value="company">Corporation</TabsTrigger>
            <TabsTrigger value="personal">Individual</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {companyPlans.map((p) => (
                <Card key={p.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <Badge variant="secondary">Monthly</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">${p.price}</div>
                    <div className="text-sm text-muted-foreground">Metered</div>
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      {companyMetered.map((m) => (<li key={m}>{m}</li>))}
                    </ul>
                    <Button className="w-full" disabled>Coming soon</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="personal" className="mt-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {personalPlans.map((p) => (
                <Card key={p.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{p.name}</span>
                      <Badge variant="secondary">Monthly</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">${p.price}</div>
                    {p.usageNote && (<div className="text-sm text-muted-foreground">{p.usageNote}</div>)}
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      {personalExtra.map((m) => (<li key={m}>{m}</li>))}
                    </ul>
                    <Button className="w-full" disabled>Coming soon</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

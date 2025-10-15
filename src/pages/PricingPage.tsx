// src/pages/pricing/Pricing.tsx
import { useState, useMemo } from "react";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type Plan = {
  name: string;
  price: string;
  meter?: string;
  bullets: string[];
  disabledCta?: boolean;
};

const INDIVIDUAL: Plan[] = [
  { name: "Free", price: "$0", meter: "Pay as you go $10/op, Exchange $5/op",
    bullets: ["Wallet sync", "Tax calc (basic)", "1 month free incl. usage"], disabledCta: true },
  { name: "Plus", price: "$30", meter: "Pay as you go $5/op, Exchange $5/op", bullets: ["Everything in Free", "Priority support"], disabledCta: true },
  { name: "Pro",  price: "$80", meter: "Pay as you go $2/op, Exchange $5/op", bullets: ["Reports export"], disabledCta: true },
];

const CORPORATE: Plan[] = [
  { name: "Starter", price: "$100", meter: "Transfer/Invoice/Payment/Exchange $8/op", bullets: ["IFRS P/L & TB", "Basic automations"], disabledCta: true },
  { name: "Growth",  price: "$250", meter: "Transfer/Invoice/Payment/Exchange $8/op", bullets: ["Multi-wallet", "Team access"], disabledCta: true },
  { name: "Scale",   price: "$500", meter: "Transfer/Invoice/Payment/Exchange $8/op", bullets: ["Audit logs", "SLA"], disabledCta: true },
];

export default function Pricing() {
  const { profile, save } = useProfile();
  const [tab, setTab] = useState<"personal" | "corporate">("personal");

  const mode: "personal" | "corporate" | "unknown" = useMemo(() => {
    if (!profile?.entity_type) return "unknown";
    return profile.entity_type;
  }, [profile?.entity_type]);

  const plans = mode === "corporate"
    ? CORPORATE
    : mode === "personal"
      ? INDIVIDUAL
      : tab === "corporate" ? CORPORATE : INDIVIDUAL;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Pricing</h1>

      {mode === "unknown" && (
        <Card>
          <CardHeader><CardTitle>Select account type</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button variant={tab==='personal' ? 'default' : 'outline'} onClick={() => setTab('personal')}>Individual</Button>
              <Button variant={tab==='corporate' ? 'default' : 'outline'} onClick={() => setTab('corporate')}>Corporate</Button>
            </div>
            <div className="text-sm text-muted-foreground">You can set your account type in <Link to="/profile" className="underline">Profile</Link>.</div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((p) => (
          <Card key={p.name} className="flex flex-col">
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 flex-1">
              <div className="text-3xl font-bold">{p.price}</div>
              {p.meter && <div className="text-sm text-muted-foreground">{p.meter}</div>}
              <ul className="list-disc pl-5 text-sm">
                {p.bullets.map((b, i) => (<li key={i}>{b}</li>))}
              </ul>
              <Button className="mt-3" disabled>Checkout (coming soon)</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {mode !== "unknown" && (
        <div className="text-sm text-muted-foreground">
          Showing plans for <b>{mode === "personal" ? "Individual" : "Corporate"}</b>.
          &nbsp;<Link to="/profile" className="underline">Change in Profile</Link>
        </div>
      )}
    </div>
  );
}

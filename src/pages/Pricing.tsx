// src/pages/Pricing.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Plan = { id: string; name: string; kind: "individual" | "corporate"; price: string; features: string[] };

const ALL_PLANS: Plan[] = [
  { id: "ind-basic", name: "Individual Basic", kind: "individual", price: "$0", features: ["Read-only", "1 wallet"] },
  { id: "ind-pro", name: "Individual Pro", kind: "individual", price: "$9", features: ["Up to 5 wallets", "Export CSV"] },
  { id: "corp-standard", name: "Corporate Standard", kind: "corporate", price: "$99", features: ["Multiple users", "SLA support"] },
  { id: "corp-plus", name: "Corporate Plus", kind: "corporate", price: "$299", features: ["SSO", "Custom roles"] },
];

export default function Pricing() {
  const { user } = useAuth();
  const [entityType, setEntityType] = useState<"individual"|"corporate"|null>(null);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase.from("profiles").select("entity_type").eq("id", user.id).maybeSingle();
      const et = (data?.entity_type as any) ?? null;
      if (et === "individual" || et === "corporate") setEntityType(et);
      else setEntityType(null);
    })();
  }, [user?.id]);

  const plans = useMemo(() => {
    if (entityType === "individual") return ALL_PLANS.filter(p=>p.kind==="individual");
    if (entityType === "corporate") return ALL_PLANS.filter(p=>p.kind==="corporate");
    return ALL_PLANS; // 不明なら両方
  }, [entityType]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-bold">Pricing</h1>
      {entityType ? (
        <p className="text-sm text-muted-foreground">
          Showing plans for <b>{entityType}</b>.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          We couldn't detect your profile type; showing all plans.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((p)=>(
          <div key={p.id} className="border rounded-xl p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">{p.name}</h2>
              <div className="text-2xl font-bold">{p.price}/mo</div>
            </div>
            <ul className="mt-3 list-disc ml-5">
              {p.features.map((f,i)=> <li key={i}>{f}</li>)}
            </ul>
            <button className="mt-4 px-3 py-2 rounded bg-blue-600 text-white">
              Choose plan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

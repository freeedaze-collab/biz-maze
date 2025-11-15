// src/pages/Pricing.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type EntityType = "individual" | "company" | null;

export default function Pricing() {
  const [entity, setEntity] = useState<EntityType>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("entity_type").maybeSingle();
      setEntity((data?.entity_type as EntityType) ?? null);
      setLoading(false);
    })();
  }, []);

  const showIndividual = entity === "individual" || entity === null;
  const showCompany = entity === "company" || entity === null;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-extrabold">Pricing</h1>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {showIndividual && (
            <div className="border rounded-xl p-4">
              <h2 className="font-semibold">Individual</h2>
              <p className="text-sm text-muted-foreground">
                For solo users. Includes wallet linking, read-only exchange sync, and basic
                statements.
              </p>
              <div className="mt-2 text-2xl font-bold">$9 / mo</div>
              <button className="mt-3 px-3 py-2 rounded bg-blue-600 text-white">
                Choose Individual
              </button>
            </div>
          )}
          {showCompany && (
            <div className="border rounded-xl p-4">
              <h2 className="font-semibold">Business</h2>
              <p className="text-sm text-muted-foreground">
                For companies. Multi-user seats, roles, and advanced accounting exports.
              </p>
              <div className="mt-2 text-2xl font-bold">$39 / mo</div>
              <button className="mt-3 px-3 py-2 rounded bg-blue-600 text-white">
                Choose Business
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// src/pages/Pricing.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Profile = { user_type?: "individual"|"corporation" };
type Plan = { id: string; name: string; audience: "individual"|"corporation"; price: string; features: string[] };

const ALL_PLANS: Plan[] = [
  { id:"ind_basic", name:"Individual Basic", audience:"individual", price:"$0", features:["Read-only","1 wallet"] },
  { id:"ind_pro",   name:"Individual Pro",   audience:"individual", price:"$9", features:["Up to 3 wallets","CSV export"] },
  { id:"corp_basic",name:"Business Starter", audience:"corporation", price:"$29", features:["Team seats","Basic reports"] },
  { id:"corp_pro",  name:"Business Pro",     audience:"corporation", price:"$99", features:["Advanced reports","API access"] },
];

export default function Pricing() {
  const [profile, setProfile] = useState<Profile>({});

  useEffect(()=>{ (async()=>{
    const { data } = await supabase.from("profiles").select("user_type").maybeSingle();
    if (data) setProfile(data as any);
  })(); }, []);

  const audience = profile.user_type ?? "individual";
  const plans = ALL_PLANS.filter(p => p.audience === audience);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <p className="text-sm text-muted-foreground">
        Showing plans for <b>{audience}</b>. You can change your user type in <a className="underline" href="/profile">Profile</a>.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {plans.map(pl => (
          <div key={pl.id} className="border rounded-xl p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">{pl.name}</h2>
              <div className="text-xl">{pl.price}/mo</div>
            </div>
            <ul className="mt-2 text-sm list-disc ml-5">
              {pl.features.map((f,i)=><li key={i}>{f}</li>)}
            </ul>
            <button className="mt-3 px-3 py-2 rounded bg-blue-600 text-white">Choose plan</button>
          </div>
        ))}
      </div>
    </div>
  );
}

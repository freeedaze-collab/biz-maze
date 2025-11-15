// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Profile = { country?: string; user_type?: "individual"|"corporation"; corp_type?: string; corp_state?: string };

export default function ProfilePage() {
  const [p, setP] = useState<Profile>({});
  const [saving, setSaving] = useState(false);

  useEffect(()=>{ (async()=>{
    const { data } = await supabase.from("profiles").select("*").maybeSingle();
    if (data) setP(data as any);
  })(); }, []);

  async function save() {
    setSaving(true);
    await supabase.from("profiles").upsert(p, { onConflict: "id" });
    setSaving(false);
    alert("Saved");
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-bold">Edit Profile</h1>

      <label className="text-sm">Country</label>
      <select className="border rounded px-2 py-1 w-full" value={p.country ?? ""} onChange={e=>setP({...p, country: e.target.value})}>
        <option value="">Select</option>
        <option value="US">United States</option>
        <option value="JP">Japan</option>
      </select>

      <label className="text-sm">User Type</label>
      <select className="border rounded px-2 py-1 w-full" value={p.user_type ?? "individual"} onChange={e=>setP({...p, user_type: e.target.value as any})}>
        <option value="individual">Individual</option>
        <option value="corporation">Corporation</option>
      </select>

      {p.user_type === "corporation" && (
        <>
          <label className="text-sm">Corporation Type</label>
          <select className="border rounded px-2 py-1 w-full" value={p.corp_type ?? ""} onChange={e=>setP({...p, corp_type: e.target.value})}>
            <option value="">Select</option>
            <option value="C Corporation">C Corporation</option>
            <option value="LLC">LLC</option>
          </select>

          <label className="text-sm">Incorporation State</label>
          <select className="border rounded px-2 py-1 w-full" value={p.corp_state ?? ""} onChange={e=>setP({...p, corp_state: e.target.value})}>
            <option value="">Select</option>
            <option value="California">California</option>
            <option value="Delaware">Delaware</option>
          </select>
        </>
      )}

      <button onClick={save} disabled={saving} className="px-3 py-2 rounded bg-blue-600 text-white">
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

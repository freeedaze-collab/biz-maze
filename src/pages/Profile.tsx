// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id?: string;
  country?: string | null;
  entity_type?: "individual" | "company" | null;
  company_type?: string | null;
  company_state?: string | null;
};

export default function Profile() {
  const [p, setP] = useState<Profile>({});
  const [saving, setSaving] = useState(false);
  const toast = (m: string) => alert(m);

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").maybeSingle();
    if (data) setP(data as Profile);
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert(p, { onConflict: "id" });
      if (error) throw error;
      toast("Saved.");
    } catch (e: any) {
      toast(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-extrabold">Edit Profile</h1>

      <div className="flex flex-col gap-3">
        <label className="text-sm">Country</label>
        <select
          className="border rounded px-3 py-2"
          value={p.country ?? ""}
          onChange={(e) => setP((s) => ({ ...s, country: e.target.value }))}
        >
          <option value="">—</option>
          <option value="US">United States</option>
          <option value="JP">Japan</option>
          <option value="PH">Philippines</option>
        </select>

        <label className="text-sm">User Type</label>
        <select
          className="border rounded px-3 py-2"
          value={p.entity_type ?? ""}
          onChange={(e) =>
            setP((s) => ({ ...s, entity_type: e.target.value as Profile["entity_type"] }))
          }
        >
          <option value="">—</option>
          <option value="individual">Individual</option>
          <option value="company">Company</option>
        </select>

        {p.entity_type === "company" && (
          <>
            <label className="text-sm">Company Type</label>
            <select
              className="border rounded px-3 py-2"
              value={p.company_type ?? ""}
              onChange={(e) => setP((s) => ({ ...s, company_type: e.target.value }))}
            >
              <option value="">—</option>
              <option value="C Corporation">C Corporation</option>
              <option value="LLC">LLC</option>
            </select>

            <label className="text-sm">Company State/Prefecture</label>
            <input
              className="border rounded px-3 py-2"
              placeholder="e.g. California"
              value={p.company_state ?? ""}
              onChange={(e) => setP((s) => ({ ...s, company_state: e.target.value }))}
            />
          </>
        )}

        <button
          onClick={save}
          className="rounded bg-blue-600 text-white py-2 disabled:opacity-50"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
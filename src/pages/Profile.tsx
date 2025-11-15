// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ProfileRow = {
  id: string;
  country?: string | null;
  entity_type?: "individual" | "corporate" | null; // 推測。既存列名に合わせて読み替え可
  corp_state?: string | null;
};

export default function Profile() {
  const { user } = useAuth();
  const [p, setP] = useState<ProfileRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) setP(data as any);
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [user?.id]);

  const save = async () => {
    if (!user?.id || !p) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("profiles").update(p).eq("id", user.id);
    setBusy(false);
    setMsg(error ? `Save failed: ${error.message}` : "Saved.");
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-bold">Edit Profile</h1>

      {!p ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="w-28">Country:</label>
            <select
              className="border rounded px-2 py-1"
              value={p.country ?? ""}
              onChange={(e)=>setP({...p, country: e.target.value})}
            >
              <option value="">—</option>
              <option value="US">United States</option>
              <option value="JP">Japan</option>
              <option value="PH">Philippines</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="w-28">User Type:</label>
            <select
              className="border rounded px-2 py-1"
              value={p.entity_type ?? ""}
              onChange={(e)=>setP({...p, entity_type: e.target.value as any})}
            >
              <option value="">—</option>
              <option value="individual">Individual</option>
              <option value="corporate">Corporate</option>
            </select>
          </div>

          {p.entity_type === "corporate" && (
            <div className="flex items-center gap-2">
              <label className="w-28">US State (if applicable):</label>
              <input
                className="border rounded px-2 py-1"
                placeholder="e.g., California"
                value={p.corp_state ?? ""} onChange={(e)=>setP({...p, corp_state: e.target.value})}
              />
            </div>
          )}

          <button className="px-3 py-2 rounded border" onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </button>
          {msg && <div className="text-sm">{msg}</div>}
        </div>
      )}
    </div>
  );
}

// src/hooks/useProfile.ts
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

export type Profile = {
  id?: string;
  user_id?: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  country?: string | null;            // 追加想定
  entity_type?: "personal" | "corporate" | null; // 追加想定
  features?: Record<string, any> | null;         // JSONB 追加想定
  created_at?: string;
  updated_at?: string;
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: s } = await supabase.auth.getSession();
        const uid = s.session?.user?.id;
        if (!uid) {
          setProfile(null);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", uid)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        setProfile(data ?? null);
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (patch: Partial<Profile>) => {
    setErr(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id;
      if (!uid) throw new Error("unauthenticated");
      const row = {
        user_id: uid,
        ...profile,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      // upsert by user_id
      const { data, error } = await supabase
        .from("profiles")
        .upsert(row, { onConflict: "user_id" })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      setProfile(data);
      return data;
    } catch (e: any) {
      setErr(e?.message || String(e));
      throw e;
    }
  };

  return { profile, save, loading, err };
}

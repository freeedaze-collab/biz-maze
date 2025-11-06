// src/utils/authToken.ts
import { supabase } from "@/integrations/supabase/client";

/**
 * SupabaseのJWTを「あり得る全パターン」から取得するヘルパー。
 * 1) supabase.auth.getSession() の access_token
 * 2) localStorage['sb-<project>-auth-token'] の
 *    - currentSession.access_token
 *    - session.access_token
 *    - access_token
 */
export async function getSupabaseJwt(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) return data.session.access_token;
  } catch {
    // noop
  }

  try {
    const key = Object.keys(localStorage).find(
      (x) => x.startsWith("sb-") && x.endsWith("-auth-token")
    );
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    return (
      parsed?.currentSession?.access_token ??
      parsed?.session?.access_token ??
      parsed?.access_token ??
      null
    );
  } catch {
    return null;
  }
}

// src/integrations/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

// .env の VITE_ プレフィックスを使用（Vite）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "sb-auth", // どこかで複数キーを使っていないか注意
  },
});

// Supabase client (singleton) — browser only
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined;
}

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

const storageKey = 'bizmaze-auth'; // アプリ固有のキー名

export const supabase: SupabaseClient =
  globalThis.__supabase__ ??
  createClient(url ?? '', anon ?? '', {
    auth: {
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      // ネットワーク問題を検知しやすくする
      fetch: async (input, init) => {
        try {
          const res = await fetch(input as RequestInfo, init);
          return res;
        } catch (e) {
          console.error('Supabase fetch failed:', input, e);
          throw e;
        }
      },
    },
  });

globalThis.__supabase__ = supabase;

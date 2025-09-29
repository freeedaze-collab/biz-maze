// Supabase client (singleton) — browser only
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  // Prevent re-creating across HMR or multiple imports
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined;
}

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ここが未設定だと他の箇所で固まりやすいので、開発時は明示ログ
if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

const storageKey = 'bizmaze-auth'; // アプリ固有のキー名にする

export const supabase: SupabaseClient =
  globalThis.__supabase__ ??
  createClient(url ?? '', anon ?? '', {
    auth: {
      storageKey,             // 同一ブラウザ文脈で一意
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // /auth/callback を使う場合は true のまま
    },
  });

globalThis.__supabase__ = supabase;

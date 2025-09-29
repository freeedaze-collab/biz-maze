// Supabase client (singleton) — preview-safe
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined;
}

function sanitize(v: string | undefined | null) {
  if (!v) return v;
  const trimmed = v.trim().replace(/^['"]|['"]$/g, '');
  return trimmed.replace(/\/+$/, '');
}

// ⚠️ ここでは「検証で例外を投げない」＝ビルド時に落ちない
const url  = sanitize(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const anon = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

// env が未設定でもとりあえず作る（実行時の API 呼び出しで UI に分かる形で失敗させる）
const FALLBACK_URL  = url  || 'https://example.supabase.co';
const FALLBACK_ANON = anon || 'ey.invalid.placeholder';

// HMR/多重importでも単一に
export const supabase: SupabaseClient =
  globalThis.__supabase__ ??
  createClient(FALLBACK_URL, FALLBACK_ANON, {
    auth: {
      storageKey: 'bizmaze-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: async (input, init) => {
        // 実行時のチェック：環境変数が無い/URLが不正ならここで可視化
        if (!url || !anon) {
          console.error('[Env] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
        } else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
          console.error('[Env] VITE_SUPABASE_URL looks wrong:', url);
        }
        return fetch(input as RequestInfo, init);
      },
    },
  });

globalThis.__supabase__ = supabase;

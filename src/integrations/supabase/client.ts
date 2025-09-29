// Supabase client (singleton) — browser only
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined;
  // eslint-disable-next-line no-var
  var __SUPABASE_ENV_ERROR__: string | undefined;
}

/** .env 値の余計な引用符/空白/末尾スラッシュを掃除 */
function sanitize(v: string | undefined | null) {
  if (!v) return v;
  const trimmed = v.trim().replace(/^['"]|['"]$/g, '');
  return trimmed.replace(/\/+$/, '');
}

const rawUrl  = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const url  = sanitize(rawUrl);
const anon = sanitize(rawAnon);

/** https://<ref>.supabase.co の形式のみ許容（最短でミスに気付けるよう厳しめにチェック） */
const urlOk = !!url && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);

if (!urlOk || !anon) {
  const why = !urlOk
    ? `VITE_SUPABASE_URL is invalid. Got: "${rawUrl ?? ''}". Expected: https://<project-ref>.supabase.co`
    : `VITE_SUPABASE_ANON_KEY is missing.`;
  // 開発時に即気付けるよう保持＆ログ
  globalThis.__SUPABASE_ENV_ERROR__ = why;
  // eslint-disable-next-line no-console
  console.error(why);
}

const storageKey = 'bizmaze-auth'; // アプリ固有 key。別アプリと衝突しない名称に

export const supabase: SupabaseClient =
  globalThis.__supabase__ ??
  createClient(url || 'https://invalid.supabase.co', anon || 'invalid', {
    auth: {
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      // 通信層の失敗や環境変数不備を可視化
      fetch: async (input, init) => {
        if (globalThis.__SUPABASE_ENV_ERROR__) {
          throw new Error(globalThis.__SUPABASE_ENV_ERROR__);
        }
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

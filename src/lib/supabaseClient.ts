// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * 複数の createClient 実行（特にViteのHMRや重複import）を避けるためのシングルトン。
 * - storageKey をプロジェクトごとに一意にして、別タブ/別アプリと衝突しないようにする
 * - 開発時に env ミスを即検出
 */
const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const rawAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

function assertEnv() {
  if (!rawUrl || !rawAnon) {
    throw new Error(
      [
        '[Supabase env error] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定です。',
        '例:',
        '  VITE_SUPABASE_URL=https://xxxx.supabase.co',
        '  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
      ].join('\n')
    )
  }
  const dotCount = (rawAnon.match(/\./g) || []).length
  if (dotCount < 2) {
    throw new Error('[Supabase env error] ANON KEY の形式が不正です（JWT想定）。Dashboard → Project Settings → API → anon public を使用。')
  }
}
assertEnv()

/** URL からプロジェクトrefっぽいキーを抽出（storageKeyに利用） */
function deriveProjectRef(url: string) {
  try {
    const u = new URL(url)
    // 例: https://abcd1234.supabase.co → abcd1234
    const m = u.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return m ? m[1] : u.hostname.replace(/\W+/g, '_')
  } catch {
    return 'default'
  }
}

const PROJECT_REF = deriveProjectRef(rawUrl)
// 明示的に上書きしたい場合は .env で指定可
const STORAGE_KEY =
  (import.meta.env.VITE_SUPABASE_STORAGE_KEY as string | undefined)?.trim() ||
  `sb-${PROJECT_REF}-auth-token`

declare global {
  // eslint-disable-next-line no-var
  var __SUPABASE_CLIENT__: SupabaseClient | undefined
}

function createSingletonClient(): SupabaseClient {
  if (globalThis.__SUPABASE_CLIENT__) return globalThis.__SUPABASE_CLIENT__

  const client = createClient(rawUrl, rawAnon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: STORAGE_KEY, // ← ここが衝突回避のキモ
      flowType: 'pkce',        // 最新推奨（メール/パスワードにも影響なし）
    },
  })

  globalThis.__SUPABASE_CLIENT__ = client
  return client
}

export const supabase = createSingletonClient()

/** Edge Function 呼び出しの共通ヘッダ（セッションBearer優先 → anonフォールバック） */
export async function authHeaders(preferSession = true): Promise<Record<string, string>> {
  if (preferSession) {
    const { data, error } = await supabase.auth.getSession()
    if (!error && data?.session?.access_token) {
      return {
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
      }
    }
  }
  return {
    Authorization: `Bearer ${rawAnon}`,
    'Content-Type': 'application/json',
  }
}

/** セッションが存在するかクイックチェック */
export async function hasActiveSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return !!data?.session
}

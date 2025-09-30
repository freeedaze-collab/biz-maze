// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

/**
 * よくある原因：
 *  - Viteは `VITE_` プレフィックスの環境変数しかクライアントで読めない
 *  - URL/KEY の末尾に空白や全角スペースが入っている
 *  - KEY に Service Role を入れてしまっている（クライアントは ANON を使う）
 *  - 別プロジェクトの URL/KEY を混在させている
 */
const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

function assertEnv() {
  if (!url || !anon) {
    throw new Error(
      [
        '[Supabase env error] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定です。',
        'Vite 環境ではクライアント側からは VITE_ で始まる変数のみ参照できます。',
        '例:',
        '  VITE_SUPABASE_URL=https://xxxx.supabase.co',
        '  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
      ].join('\n')
    )
  }
  // 形式の簡易チェック：JWT 想定（ドット2個）
  const dotCount = (anon.match(/\./g) || []).length
  if (dotCount < 2) {
    throw new Error(
      '[Supabase env error] 提供された ANON KEY の形式が不正です（JWT想定）。Supabase ダッシュボードの "Project Settings" → "API" → "anon public" を使用してください。'
    )
  }
  // URL の簡易チェック
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co/.test(url)) {
    console.warn('[Supabase env warn] URL が supabase.co ドメインではない、または形式が異なります。カスタムドメイン運用時は有効ですが、誤りに注意してください。')
  }
}
assertEnv()

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Edge Function 呼び出し時のヘッダ作成を一元化
 * - セッションがあれば Bearer <access_token>
 * - なければ anon key でフォールバック（verify-jwt が不要な関数のみ想定）
 */
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
    Authorization: `Bearer ${anon}`,
    'Content-Type': 'application/json',
  }
}

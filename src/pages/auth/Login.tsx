// src/pages/auth/Login.tsx
import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

/**
 * ログイン画面：
 * - 成功時：トップ（/）へハードリダイレクト（ルーター非依存で確実に反映）
 * - エラー時：メッセージを明示（Invalid login / Email未確認 / envミス）
 * - 二重送信防止、Enter送信対応
 */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setInfo(null)

    if (!email || !password) {
      setErr('Email と Password を入力してください。')
      return
    }

    setLoading(true)
    try {
      // サインインを実行
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        // 代表的なエラーの出し分け
        const msg = String(error.message ?? error)
        if (/invalid login credentials/i.test(msg)) {
          setErr('メールアドレスまたはパスワードが正しくありません。')
        } else if (/email not confirmed|email not confirmed/i.test(msg)) {
          setErr('このメールアドレスは未確認です。確認メールのリンクを踏んでから再度お試しください。')
        } else if (/Invalid API key/i.test(msg)) {
          setErr([
            'Invalid API key（環境変数の設定不備）が検出されました。',
            'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を確認し、開発サーバを再起動してください。'
          ].join('\n'))
        } else {
          setErr(msg)
        }
        return
      }

      // Supabaseの仕様上、メール確認が有効になっていると session が返らないことがある
      if (!data?.session) {
        // 既にユーザーは見つかっているが、メール未確認等の可能性
        setInfo('ログイン要求は受け付けましたが、セッションが確立されていません。メール認証（Confirm Email）を完了してから再度お試しください。')
        return
      }

      // 成功：トップへリダイレクト（ルーター非依存・最も確実）
      window.location.replace('/')

    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  // Enterキーで送信
  const onKeyDown: React.KeyboardEventHandler<HTMLFormElement> = (ev) => {
    if (ev.key === 'Enter' && !loading) {
      onSubmit(ev as unknown as React.FormEvent)
    }
  }

  return (
    <form className="max-w-sm mx-auto p-4 space-y-3" onSubmit={onSubmit} onKeyDown={onKeyDown}>
      <h1 className="text-xl font-bold">Login</h1>

      <label className="block text-sm">Email</label>
      <input
        className="w-full border rounded-md px-3 py-2"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />

      <label className="block text-sm">Password</label>
      <input
        className="w-full border rounded-md px-3 py-2"
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />

      {err && <pre className="text-red-600 whitespace-pre-wrap text-sm">{err}</pre>}
      {info && <pre className="text-blue-700 whitespace-pre-wrap text-sm">{info}</pre>}

      <button className="px-4 py-2 border rounded-md w-full" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="text-xs text-gray-500 pt-2 space-y-1">
        <div>・ログイン後に画面が変わらない場合は、画面右上のアカウント表示やメニューが更新されているか確認してください。</div>
        <div>・メール確認を有効にしている場合は、認証メールのリンクをクリック後に再ログインが必要です。</div>
      </div>
    </form>
  )
}

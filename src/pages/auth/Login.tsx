// src/pages/auth/Login.tsx
import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const nav = useNavigate()
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        const msg = String(error.message ?? error)
        if (/invalid login credentials/i.test(msg)) {
          setErr('メールアドレスまたはパスワードが正しくありません。')
        } else if (/email not confirmed/i.test(msg)) {
          setErr('このメールアドレスは未確認です。確認メールのリンクを踏んでから再度お試しください。')
        } else if (/Invalid API key/i.test(msg)) {
          setErr([
            'Invalid API key（環境変数の設定不備）が検出されました。',
            'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を確認し、開発サーバを再起動してください。',
          ].join('\n'))
        } else {
          setErr(msg)
        }
        return
      }

      if (!data?.session) {
        setInfo('ログイン要求は受け付けましたが、セッションが確立されていません。確認メール（Confirm Email）後に再ログインしてください。')
        return
      }

      // 成功 → ダッシュボードへ
      nav('/dashboard', { replace: true })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLFormElement> = (ev) => {
    if (ev.key === 'Enter' && !loading) onSubmit(ev as unknown as React.FormEvent)
  }

  return (
    <form className="max-w-sm mx-auto p-6 space-y-4" onSubmit={onSubmit} onKeyDown={onKeyDown}>
      <h1 className="text-xl font-bold">Sign in</h1>

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
    </form>
  )
}

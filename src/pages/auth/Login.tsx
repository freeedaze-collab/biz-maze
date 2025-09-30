// src/pages/auth/Login.tsx
import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // 成功 → 画面遷移はルーター側で
    } catch (e: any) {
      const msg: string = e?.message ?? String(e)
      // Supabase SDK の Invalid API key を捕捉し、明示的に案内
      if (/Invalid API key/i.test(msg)) {
        setErr([
          'ログインに失敗しました（Invalid API key）。以下を確認してください：',
          '1) .env に VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が正しく設定されているか',
          '2) 値に余計な空白や改行が入っていないか',
          '3) ANON KEY（public）を使っているか（Service Role は使用不可）',
          '4) 変更後は開発サーバを再起動したか（Vite は起動時に env を読むため）',
        ].join('\n'))
      } else {
        setErr(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="max-w-sm mx-auto p-4 space-y-3" onSubmit={onSubmit}>
      <h1 className="text-xl font-bold">Login</h1>
      <input
        className="w-full border rounded-md px-3 py-2"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full border rounded-md px-3 py-2"
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {err && <pre className="text-red-600 whitespace-pre-wrap text-sm">{err}</pre>}
      <button className="px-4 py-2 border rounded-md" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

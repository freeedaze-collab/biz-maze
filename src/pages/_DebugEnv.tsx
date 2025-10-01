// src/pages/_DebugEnv.tsx
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

function mask(str?: string | null) {
  if (!str) return ''
  if (str.length <= 10) return '********'
  return `${str.slice(0, 6)}...${str.slice(-6)}`
}

export default function DebugEnv() {
  const [sessionInfo, setSessionInfo] = useState<string>('(loading)')
  const [localKeys, setLocalKeys] = useState<string[]>([])
  const [wcInfo, setWcInfo] = useState<{enabled:boolean; reason:string}>({enabled:false, reason:'n/a'})

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const s = data?.session
      setSessionInfo(JSON.stringify({
        hasSession: !!s,
        userId: s?.user?.id ?? null,
        expiresAt: s?.expires_at ?? null,
      }, null, 2))
    })()

    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-')) keys.push(k)
    }
    setLocalKeys(keys.sort())

    // wagmi / walletconnect の有効判定をコードと同等ロジックで
    const pid = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '').trim()
    const allowedRaw = (import.meta.env.VITE_WC_ALLOWED_ORIGINS ?? '')
    const disabled = String(import.meta.env.VITE_WC_DISABLE ?? '').toLowerCase()
    const allowed = allowedRaw.split(',').map(s => s.trim()).filter(Boolean)
    const origin = window.location.origin
    let enabled = false
    let reason = ''
    if (disabled === '1' || disabled === 'true') {
      enabled = false; reason = 'VITE_WC_DISABLE=1'
    } else if (!pid) {
      enabled = false; reason = 'no projectId'
    } else if (allowed.length && !allowed.some(a => origin.includes(a))) {
      enabled = false; reason = `origin not allowed: ${origin}`
    } else {
      enabled = true; reason = 'ok'
    }
    setWcInfo({ enabled, reason })
  }, [])

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4 text-sm">
      <h1 className="text-xl font-bold">Debug / Env</h1>

      <section className="space-y-1">
        <div>origin: <b>{window.location.origin}</b></div>
        <div>VITE_SUPABASE_URL: <code>{import.meta.env.VITE_SUPABASE_URL}</code></div>
        <div>VITE_SUPABASE_ANON_KEY: <code>{mask(import.meta.env.VITE_SUPABASE_ANON_KEY)}</code></div>
        <div>VITE_WALLETCONNECT_PROJECT_ID: <code>{mask(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID)}</code></div>
        <div>VITE_WC_ALLOWED_ORIGINS: <code>{import.meta.env.VITE_WC_ALLOWED_ORIGINS ?? ''}</code></div>
        <div>VITE_WC_DISABLE: <code>{String(import.meta.env.VITE_WC_DISABLE ?? '')}</code></div>
        <div>VITE_DEFAULT_CHAIN_ID: <code>{String(import.meta.env.VITE_DEFAULT_CHAIN_ID ?? '')}</code></div>
      </section>

      <section>
        <h2 className="font-semibold mt-4">session</h2>
        <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{sessionInfo}</pre>
      </section>

      <section>
        <h2 className="font-semibold mt-4">localStorage keys (sb-*)</h2>
        <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{localKeys.join('\n') || '(none)'}</pre>
      </section>

      <section>
        <h2 className="font-semibold mt-4">walletconnect</h2>
        <div>enabled: <b>{String(wcInfo.enabled)}</b> / reason: <code>{wcInfo.reason}</code></div>
      </section>
    </div>
  )
}

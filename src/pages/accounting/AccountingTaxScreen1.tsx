// src/pages/accounting/AccountingTaxScreen1.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import { triggerWalletSync } from '@/lib/walletSync'
import { WalletConnectButton } from '@/components/WalletConnectButton'
import TaxEngineRouter from '@/components/TaxEngineRouter'

type Profile = Database['public']['Tables']['profiles']['Row']

export default function AccountingTaxScreen1() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data as Profile)
    })()
  }, [])

  const country = useMemo(() => profile?.tax_country ?? 'IFRS', [profile])

  const handleSync = async () => {
    setSyncing(true)
    setErr(null)
    const res = await triggerWalletSync('polygon').catch((e) => ({ ok: false, message: e?.message }))
    if (!res.ok) setErr(res.message ?? 'Sync failed')
    setSyncing(false)
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounting / Tax</h1>
        <div className="flex gap-2">
          <WalletConnectButton />
          <button className="px-3 py-2 rounded-md border" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Resync (Polygon)'}
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Account type: <b>{profile?.account_type ?? '—'}</b> / Country: <b>{country}</b>
      </div>

      {err && <div className="text-red-600">{err}</div>}

      {/* 国・アカウント種別ごとに税務/会計の表示・集計を切替 */}
      <TaxEngineRouter profile={profile ?? undefined} />
    </div>
  )
}

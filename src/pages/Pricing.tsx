// src/pages/Pricing.tsx
import React, { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

type Plan = {
  code: string
  name: string
  features: string[]
}

const INDIVIDUAL_PLANS: Plan[] = [
  { code: 'starter', name: 'Starter', features: ['Basic tracking', 'Manual sync'] },
  { code: 'pro', name: 'Pro', features: ['Auto sync', 'IFRS/US tax summary'] },
]

const BUSINESS_PLANS: Plan[] = [
  { code: 'business', name: 'Business', features: ['Multi-wallet', 'Team seats', 'Export'] },
  { code: 'enterprise', name: 'Enterprise', features: ['SLA', 'Dedicated support'] },
]

export default function Pricing() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data as Profile)
    })()
  }, [])

  const plans = profile?.account_type === 'business' ? BUSINESS_PLANS : INDIVIDUAL_PLANS

  const selectPlan = async (code: string) => {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').upsert({ id: profile.id, plan_type: code }, { onConflict: 'id' })
    setSaving(false)
    setProfile({ ...profile, plan_type: code })
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Pricing ({profile?.account_type ?? 'individual'})</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {plans.map((p) => (
          <div key={p.code} className="border rounded-xl p-4 space-y-2">
            <div className="text-xl font-semibold">{p.name}</div>
            <ul className="list-disc pl-6 text-sm">
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <button
              className="px-4 py-2 border rounded-md"
              onClick={() => selectPlan(p.code)}
              disabled={saving}
            >
              {profile?.plan_type === p.code ? 'Selected' : 'Select'}
            </button>
          </div>
        ))}
      </div>
      <div className="text-sm text-gray-600">
        * 決済ボタンは未実装（要件通り）。プランはプロフィールに保存されます。
      </div>
    </div>
  )
}

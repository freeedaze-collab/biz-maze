// src/pages/settings/CountryCompanySettings.tsx
import React, { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

export default function CountryCompanySettings() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data as Profile)
    })()
  }, [])

  const onSave = async () => {
    if (!profile) return
    setSaving(true)
    setMsg(null)
    const { error } = await supabase.from('profiles').upsert({
      id: profile.id,
      account_type: profile.account_type ?? 'individual',
      entity_type: profile.entity_type ?? null,
      tax_country: profile.tax_country ?? null,
      plan_type: profile.plan_type ?? null,
    }, { onConflict: 'id' })
    setMsg(error ? error.message : 'Saved!')
    setSaving(false)
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Entity & Country Settings</h1>

      <div className="space-y-2">
        <label className="text-sm">Account Type</label>
        <select
          className="w-full border rounded-md px-3 py-2"
          value={profile?.account_type ?? 'individual'}
          onChange={(e) => setProfile(p => ({ ...(p as Profile), account_type: e.target.value as any }))}
        >
          <option value="individual">Individual</option>
          <option value="business">Business</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm">Entity Type (optional)</label>
        <input
          className="w-full border rounded-md px-3 py-2"
          placeholder="LLC, Sole Proprietor, etc."
          value={profile?.entity_type ?? ''}
          onChange={(e) => setProfile(p => ({ ...(p as Profile), entity_type: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm">Tax Country</label>
        <input
          className="w-full border rounded-md px-3 py-2"
          placeholder="US / JP / PH / …"
          value={profile?.tax_country ?? ''}
          onChange={(e) => setProfile(p => ({ ...(p as Profile), tax_country: e.target.value }))}
        />
      </div>

      <button className="px-4 py-2 border rounded-md" onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>

      {msg && <div className="text-sm">{msg}</div>}
    </div>
  )
}

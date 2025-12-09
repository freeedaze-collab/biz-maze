// src/pages/Profile.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useUser } from '@/hooks/useUser'
import { AppLayout } from '@/components/AppLayout'

export default function Profile() {
  const { user, loading: userLoading } = useUser()
  const [loading, setLoading] = useState(true)

  const [country, setCountry] = useState('')
  const [userType, setUserType] = useState('')
  const [incomeBracket, setIncomeBracket] = useState('')
  const [entityType, setEntityType] = useState('')
  const [stateOfIncorp, setStateOfIncorp] = useState('')
  const [message, setMessage] = useState<string>('')

  const showIncomeBracket = useMemo(
    () => country === 'japan' && userType === 'individual',
    [country, userType]
  )
  const showUsCorpExtras = useMemo(
    () => country === 'usa' && userType === 'corporate',
    [country, userType]
  )

  useEffect(() => {
    if (userLoading) return
    if (!user?.id) {
      setMessage('Failed to fetch user info.')
      setLoading(false)
      return
    }
    const load = async () => {
      setLoading(true)
      setMessage('')

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, user_id, country, user_type, income_bracket,
          entity_type, us_entity_type, state_of_incorporation, us_state_of_incorporation
        `)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('[Profile] load error:', error)
        setMessage('Failed to load profile.')
        setLoading(false)
        return
      }

      if (data) {
        setCountry(data.country || '')
        setUserType(data.user_type || '')
        setIncomeBracket(data.income_bracket || '')
        setEntityType(data.entity_type || data.us_entity_type || '')
        setStateOfIncorp(data.state_of_incorporation || data.us_state_of_incorporation || '')
      }
      setLoading(false)
    }

    load()
  }, [userLoading, user?.id])

  const handleSave = async () => {
    if (!user?.id) return
    setLoading(true)
    setMessage('')

    const { data: freshUser } = await supabase.auth.getUser()
    const normalized = {
      country: country || null,
      user_type: userType || null,
      income_bracket: showIncomeBracket ? (incomeBracket || null) : null,
      entity_type: showUsCorpExtras ? (entityType || null) : null,
      us_entity_type: showUsCorpExtras ? (entityType || null) : null,
      state_of_incorporation: showUsCorpExtras ? (stateOfIncorp || null) : null,
      us_state_of_incorporation: showUsCorpExtras ? (stateOfIncorp || null) : null,
      updated_at: new Date().toISOString(),
    }

    const payload = { id: freshUser?.user?.id, user_id: freshUser?.user?.id, ...normalized }

    const { error } = await supabase.from('profiles').upsert(payload, {
      onConflict: 'user_id',
    })

    if (error) {
      console.error('[Profile] save error:', error)
      setMessage('Failed to save. Please check settings/permissions.')
    } else {
      setMessage('Saved.')
    }
    setLoading(false)
  }

  if (userLoading || loading) return <div className="p-4">Loading...</div>
  if (!user?.id) return <div className="p-4 text-red-500">User not found.</div>

  return (
    <AppLayout
      title="Profile"
      subtitle="Keep the same inputs, now styled to match the rest of the app."
    >
      <div className="max-w-xl space-y-4">
        <div className="rounded-xl border p-4 bg-white shadow-sm space-y-4">
          <div className="grid gap-4">
            <div>
              <label className="block mb-2 font-medium">Country</label>
              <select className="w-full border p-2 rounded" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Select</option>
                <option value="japan">Japan</option>
                <option value="usa">United States</option>
              </select>
            </div>

            <div>
              <label className="block mb-2 font-medium">User Type</label>
              <select className="w-full border p-2 rounded" value={userType} onChange={(e) => setUserType(e.target.value)}>
                <option value="">Select</option>
                <option value="individual">Individual</option>
                <option value="corporate">Corporation</option>
              </select>
            </div>

            {showIncomeBracket && (
              <div>
                <label className="block mb-2 font-medium">Taxable Income (Japan)</label>
                <select className="w-full border p-2 rounded" value={incomeBracket} onChange={(e) => setIncomeBracket(e.target.value)}>
                  <option value="">Select</option>
                  <option value="under800">Under 8M JPY</option>
                  <option value="over800">8M JPY or more</option>
                </select>
              </div>
            )}

            {showUsCorpExtras && (
              <>
                <div>
                  <label className="block mb-2 font-medium">Corporation Type (US)</label>
                  <select className="w-full border p-2 rounded" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                    <option value="">Select</option>
                    <option value="C-Corp">C Corporation</option>
                    <option value="S-Corp">S Corporation</option>
                    <option value="LLC">Limited Liability Company</option>
                    <option value="Partnership">Partnership</option>
                    <option value="PC/PA">Professional Corporation / Association</option>
                    <option value="PBC">Public Benefit Corporation</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">State of Incorporation</label>
                  <select className="w-full border p-2 rounded" value={stateOfIncorp} onChange={(e) => setStateOfIncorp(e.target.value)}>
                    <option value="">Select</option>
                    {[
                      'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
                      'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
                      'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
                      'Maine','Maryland','Massachusetts','Michigan','Minnesota',
                      'Mississippi','Missouri','Montana','Nebraska','Nevada',
                      'New Hampshire','New Jersey','New Mexico','New York',
                      'North Carolina','North Dakota','Ohio','Oklahoma','Oregon',
                      'Pennsylvania','Rhode Island','South Carolina','South Dakota',
                      'Tennessee','Texas','Utah','Vermont','Virginia','Washington',
                      'West Virginia','Wisconsin','Wyoming','District of Columbia'
                    ].map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <button className="bg-indigo-600 text-white px-4 py-2 rounded" onClick={handleSave} disabled={loading}>
            Save
          </button>

          {message && <div className="mt-2 text-sm">{message}</div>}
        </div>
      </div>
    </AppLayout>
  )
}

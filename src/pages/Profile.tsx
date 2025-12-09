// src/pages/Profile.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useUser } from '@/hooks/useUser'

export default function Profile() {
  const { user, loading: userLoading } = useUser()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  // UI state
  const [country, setCountry] = useState('')               // 'japan' | 'usa' | ''
  const [userType, setUserType] = useState('')             // 'individual' | 'corporate' | ''
  const [incomeBracket, setIncomeBracket] = useState('')   // 'under800' | 'over800' | ''
  const [entityType, setEntityType] = useState('')         // 'C-Corp' | 'S-Corp' | 'LLC' | 'Partnership' | 'PC/PA' | 'PBC'
  const [stateOfIncorp, setStateOfIncorp] = useState('')   // 50 states + DC
  const [message, setMessage] = useState<string>('')

  const showIncomeBracket = useMemo(
    () => country === 'japan' && userType === 'individual',
    [country, userType]
  )
  const showUsCorpExtras = useMemo(
    () => country === 'usa' && userType === 'corporate',
    [country, userType]
  )

  // Validation: check if all required fields are filled
  const isFormValid = useMemo(() => {
    if (!country || !userType) return false;
    if (showIncomeBracket && !incomeBracket) return false;
    if (showUsCorpExtras && (!entityType || !stateOfIncorp)) return false;
    return true;
  }, [country, userType, showIncomeBracket, incomeBracket, showUsCorpExtras, entityType, stateOfIncorp])

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
          country,
          account_type,
          income_bracket,
          entity_type,
          us_entity_type,
          state_of_incorporation,
          us_state_of_incorporation
        `)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.warn('[Profile] load error:', error.message)
      } else if (data) {
        setCountry(data.country ?? '')
        setUserType(data.account_type ?? '')
        setIncomeBracket(data.income_bracket ?? '')
        setEntityType(data.us_entity_type ?? data.entity_type ?? '')
        setStateOfIncorp(data.us_state_of_incorporation ?? data.state_of_incorporation ?? '')
      }
      setLoading(false)
    }
    load()
  }, [userLoading, user?.id])

  const handleSave = async () => {
    if (!isFormValid) {
      setMessage('Please fill in all required fields.')
      return
    }

    const { data: { user: freshUser }, error: uErr } = await supabase.auth.getUser()
    if (uErr || !freshUser?.id) {
      setMessage('Could not get user. Please sign in again.')
      return
    }

    setLoading(true)
    setMessage('')

    const normalized = {
      country: country || null,
      account_type: userType || null,
      income_bracket: showIncomeBracket ? (incomeBracket || null) : null,
      entity_type: showUsCorpExtras ? (entityType || null) : null,
      us_entity_type: showUsCorpExtras ? (entityType || null) : null,
      state_of_incorporation: showUsCorpExtras ? (stateOfIncorp || null) : null,
      us_state_of_incorporation: showUsCorpExtras ? (stateOfIncorp || null) : null,
      updated_at: new Date().toISOString(),
    }

    const payload = { id: freshUser.id, user_id: freshUser.id, ...normalized }

    const { error } = await supabase.from('profiles').upsert(payload, {
      onConflict: 'user_id',
    })

    if (error) {
      console.error('[Profile] save error:', error)
      setMessage('Failed to save. Please check settings/permissions.')
      setLoading(false)
    } else {
      // Success - redirect to dashboard
      navigate('/dashboard')
    }
  }

  if (userLoading || loading) return <div className="p-4">Loading...</div>
  if (!user?.id) return <div className="p-4 text-red-500">User not found.</div>

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Complete Your Profile</h1>
      <p className="text-muted-foreground mb-6">Please fill in all required fields to continue.</p>

      <label className="block mb-2">Country <span className="text-red-500">*</span></label>
      <select className="w-full border p-2 mb-4" value={country} onChange={(e) => setCountry(e.target.value)}>
        <option value="">Select</option>
        <option value="japan">Japan</option>
        <option value="usa">United States</option>
      </select>

      <label className="block mb-2">User Type <span className="text-red-500">*</span></label>
      <select className="w-full border p-2 mb-4" value={userType} onChange={(e) => setUserType(e.target.value)}>
        <option value="">Select</option>
        <option value="individual">Individual</option>
        <option value="corporate">Corporation</option>
      </select>

      {showIncomeBracket && (
        <>
          <label className="block mb-2">Taxable Income (Japan) <span className="text-red-500">*</span></label>
          <select className="w-full border p-2 mb-4" value={incomeBracket} onChange={(e) => setIncomeBracket(e.target.value)}>
            <option value="">Select</option>
            <option value="under800">Under 8M JPY</option>
            <option value="over800">8M JPY or more</option>
          </select>
        </>
      )}

      {showUsCorpExtras && (
        <>
          <label className="block mb-2">Corporation Type (US) <span className="text-red-500">*</span></label>
          <select className="w-full border p-2 mb-4" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">Select</option>
            <option value="C-Corp">C Corporation</option>
            <option value="S-Corp">S Corporation</option>
            <option value="LLC">Limited Liability Company</option>
            <option value="Partnership">Partnership</option>
            <option value="PC/PA">Professional Corporation / Association</option>
            <option value="PBC">Public Benefit Corporation</option>
          </select>

          <label className="block mb-2">State of Incorporation <span className="text-red-500">*</span></label>
          <select className="w-full border p-2 mb-4" value={stateOfIncorp} onChange={(e) => setStateOfIncorp(e.target.value)}>
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
        </>
      )}

      <button 
        className={`px-4 py-2 rounded text-white w-full ${isFormValid ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
        onClick={handleSave} 
        disabled={loading || !isFormValid}
      >
        {loading ? 'Saving...' : 'Continue to Dashboard'}
      </button>

      {message && <div className="mt-4 text-red-600">{message}</div>}
    </div>
  )
}

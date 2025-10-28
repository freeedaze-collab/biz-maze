import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/hooks/useUser'

export default function ProfilePage() {
  const { user } = useUser()

  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState('')
  const [userType, setUserType] = useState('')
  const [incomeCategory, setIncomeCategory] = useState('')
  const [entityType, setEntityType] = useState('')
  const [stateOfIncorporation, setStateOfIncorporation] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) return
    const fetchProfile = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'country, user_type, income_category, entity_type, state_of_incorporation'
        )
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Fetch profile error:', error.message)
      } else if (data) {
        setCountry(data.country || '')
        setUserType(data.user_type || '')
        setIncomeCategory(data.income_category || '')
        setEntityType(data.entity_type || '')
        setStateOfIncorporation(data.state_of_incorporation || '')
      }
      setLoading(false)
    }
    fetchProfile()
  }, [user])

  const handleSave = async () => {
    setLoading(true)
    setMessage('')
    const updates = {
      id: user?.id,
      country,
      user_type: userType,
      income_category: incomeCategory,
      entity_type: entityType || null,
      state_of_incorporation: stateOfIncorporation || null,
      updated_at: new Date(),
    }

    const { error } = await supabase.from('profiles').upsert(updates)

    if (error) {
      console.error('Save error:', error.message)
      setMessage('保存に失敗しました。')
    } else {
      setMessage('保存しました。')
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">プロフィール編集</h1>

      <label className="block mb-2">国:</label>
      <select
        className="w-full border p-2 mb-4"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
      >
        <option value="">選択してください</option>
        <option value="japan">日本</option>
        <option value="usa">アメリカ</option>
      </select>

      <label className="block mb-2">区分:</label>
      <select
        className="w-full border p-2 mb-4"
        value={userType}
        onChange={(e) => setUserType(e.target.value)}
      >
        <option value="">選択してください</option>
        <option value="individual">個人</option>
        <option value="corporate">法人</option>
      </select>

      {(country === 'japan' && userType === 'individual') && (
        <>
          <label className="block mb-2">課税所得:</label>
          <select
            className="w-full border p-2 mb-4"
            value={incomeCategory}
            onChange={(e) => setIncomeCategory(e.target.value)}
          >
            <option value="">選択してください</option>
            <option value="under800">800万円以下</option>
            <option value="over800">800万円以上</option>
          </select>
        </>
      )}

      {(country === 'usa' && userType === 'corporate') && (
        <>
          <label className="block mb-2">法人形態 (Entity Type):</label>
          <select
            className="w-full border p-2 mb-4"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">選択してください</option>
            <option value="C-Corp">C Corporation</option>
            <option value="S-Corp">S Corporation</option>
            <option value="LLC">Limited Liability Company</option>
            <option value="Partnership">Partnership</option>
            <option value="PC/PA">Professional Corporation / Association</option>
            <option value="PBC">Public Benefit Corporation</option>
          </select>

          <label className="block mb-2">所在州 (State of Incorporation):</label>
          <select
            className="w-full border p-2 mb-4"
            value={stateOfIncorporation}
            onChange={(e) => setStateOfIncorporation(e.target.value)}
          >
            <option value="">選択してください</option>
            {[
              'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
              'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
              'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
              'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana',
              'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
              'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
              'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah',
              'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
            ].map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </>
      )}

      <button
        className="bg-blue-500 text-white py-2 px-4 rounded disabled:opacity-50"
        onClick={handleSave}
        disabled={loading}
      >
        保存
      </button>

      {message && <p className="mt-4 text-green-600">{message}</p>}
    </div>
  )
}

// File: /src/pages/Profile.tsx
import { useUser } from '../hooks/useUser' // または '../hooks/useUser' に置き換えて試す
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'


export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { user, loading: userLoading } = useUser()
  const [country, setCountry] = useState('')
  const [userType, setUserType] = useState('')
  const [incomeCategory, setIncomeCategory] = useState('')
  const [entityType, setEntityType] = useState('')
  const [stateOfIncorporation, setStateOfIncorporation] = useState('')
  const [message, setMessage] = useState('')

  // 1. ユーザー情報取得（useUserを避けて Supabase API で直接取得）
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error || !user) {
        console.error('ユーザー取得失敗:', error?.message)
        setUserId(null)
        setLoading(false)
        return
      }

      setUserId(user.id)
    }

    fetchUser()
  }, [])

  // 2. プロファイル情報の取得
  useEffect(() => {
    if (!userId) return

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'country, user_type, income_category, entity_type, state_of_incorporation'
        )
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('プロフィール読み込み失敗:', error.message)
      } else if (data) {
        setCountry(data.country ?? '')
        setUserType(data.user_type ?? '')
        setIncomeCategory(data.income_category ?? '')
        setEntityType(data.entity_type ?? '')
        setStateOfIncorporation(data.state_of_incorporation ?? '')
      }

      setLoading(false)
    }

    fetchProfile()
  }, [userId])

  // 3. 保存処理
const handleSave = async () => {
  console.log("user.id:", user?.id); // ← デバッグログ追加

  if (!user?.id) {
    setMessage('ユーザーが取得できていません');
    return;
  }
    setLoading(true)

const updates = {
  user_id: user.id, // match対象（idではない！）
  country,
  user_type: userType,
  income_bracket: incomeCategory || null,
  us_entity_type: entityType || null,
  us_state_of_incorporation: stateOfIncorporation || null,
  updated_at: new Date(),
};


    const { error } = await supabase.from('profiles').update(updates).match({ user_id: user.id });

    if (error) {
      console.error('保存エラー:', error.message)
      setMessage('保存に失敗しました。')
    } else {
      setMessage('保存しました。')
    }

    setLoading(false)
  }

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (!userId) {
    return <div className="p-4 text-red-600">ログインユーザーが確認できません</div>
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

      <label className="block mb-2">ユーザー種別:</label>
      <select
        className="w-full border p-2 mb-4"
        value={userType}
        onChange={(e) => setUserType(e.target.value)}
      >
        <option value="">選択してください</option>
        <option value="individual">個人</option>
        <option value="corporate">法人</option>
      </select>

      {country === 'japan' && userType === 'individual' && (
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

      {country === 'usa' && userType === 'corporate' && (
        <>
          <label className="block mb-2">法人形態:</label>
          <select
            className="w-full border p-2 mb-4"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">選択してください</option>
            <option value="C-Corp">C Corporation</option>
            <option value="S-Corp">S Corporation</option>
            <option value="LLC">LLC</option>
            <option value="Partnership">Partnership</option>
            <option value="PC/PA">Professional Corporation / Association</option>
            <option value="PBC">Public Benefit Corporation</option>
          </select>

          <label className="block mb-2">法人州:</label>
          <select
            className="w-full border p-2 mb-4"
            value={stateOfIncorporation}
            onChange={(e) => setStateOfIncorporation(e.target.value)}
          >
            <option value="">選択してください</option>
            {[
              'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
              'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
              'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine',
              'Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
              'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
              'New Mexico','New York','North Carolina','North Dakota','Ohio',
              'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
              'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia',
              'Washington','West Virginia','Wisconsin','Wyoming'
            ].map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </>
      )}

      <button
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={handleSave}
        disabled={loading}
      >
        保存
      </button>

      {message && <div className="mt-4 text-green-600">{message}</div>}
    </div>
  )
}

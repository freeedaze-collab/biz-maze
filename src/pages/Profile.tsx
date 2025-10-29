import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/hooks/useUser'

export default function Profile() {
  const { user, loading: userLoading } = useUser()
  const [loading, setLoading] = useState(true)

  // UI state
  const [country, setCountry] = useState('')               // 'japan' | 'usa' | ''
  const [userType, setUserType] = useState('')             // 'individual' | 'corporate' | ''
  const [incomeBracket, setIncomeBracket] = useState('')   // 'under800' | 'over800' | ''
  const [entityType, setEntityType] = useState('')         // 'C-Corp' | 'S-Corp' | 'LLC' | 'Partnership' | 'PC/PA' | 'PBC'
  const [stateOfIncorp, setStateOfIncorp] = useState('')   // 50州＋DC
  const [message, setMessage] = useState<string>('')

  const showIncomeBracket = useMemo(
    () => country === 'japan' && userType === 'individual',
    [country, userType]
  )
  const showUsCorpExtras = useMemo(
    () => country === 'usa' && userType === 'corporate',
    [country, userType]
  )

  // 初回ロード: user_id 基準で取得（RLSにより自分の行のみ返る）
  useEffect(() => {
    if (userLoading) return
    if (!user?.id) {
      setMessage('ログイン情報が取得できませんでした')
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
        // 互換: us_* があれば優先、無ければ非us_* を採用
        setEntityType(data.us_entity_type ?? data.entity_type ?? '')
        setStateOfIncorp(data.us_state_of_incorporation ?? data.state_of_incorporation ?? '')
      }

      setLoading(false)
    }

    load()
  }, [userLoading, user?.id])

  // 保存
  const handleSave = async () => {
    const { data: { user: freshUser }, error: uErr } = await supabase.auth.getUser()
    if (uErr || !freshUser?.id) {
      setMessage('ユーザーが取得できません。ログインし直してください。')
      return
    }

    setLoading(true)
    setMessage('')

    const normalized = {
      country: country || null,
      account_type: userType || null,
      income_bracket: showIncomeBracket ? (incomeBracket || null) : null,

      // 互換のため、両系統に同値を書き込む
      entity_type: showUsCorpExtras ? (entityType || null) : null,
      us_entity_type: showUsCorpExtras ? (entityType || null) : null,

      state_of_incorporation: showUsCorpExtras ? (stateOfIncorp || null) : null,
      us_state_of_incorporation: showUsCorpExtras ? (stateOfIncorp || null) : null,

      updated_at: new Date().toISOString(),
    }

    const payload = {
      id: freshUser.id,
      user_id: freshUser.id,
      ...normalized,
    }

    const { error } = await supabase.from('profiles').upsert(payload, {
      onConflict: 'user_id',   // ← user_id を一意キーとして扱う
    })

    if (error) {
      console.error('[Profile] save error:', error)
      setMessage('保存に失敗しました。設定や権限をご確認ください。')
    } else {
      setMessage('保存しました。')
    }
    setLoading(false)
  }

  if (userLoading || loading) {
    return <div className="p-4">読み込み中...</div>
  }

  if (!user?.id) {
    return <div className="p-4 text-red-500">ユーザー情報が取得できません</div>
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

      {/* 日本×個人 → 課税所得区分 */}
      {showIncomeBracket && (
        <>
          <label className="block mb-2">課税所得:</label>
          <select
            className="w-full border p-2 mb-4"
            value={incomeBracket}
            onChange={(e) => setIncomeBracket(e.target.value)}
          >
            <option value="">選択してください</option>
            <option value="under800">800万円以下</option>
            <option value="over800">800万円以上</option>
          </select>
        </>
      )}

      {/* 米国×法人 → 法人形態 & 州 */}
      {showUsCorpExtras && (
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
            <option value="LLC">Limited Liability Company</option>
            <option value="Partnership">Partnership</option>
            <option value="PC/PA">Professional Corporation / Association</option>
            <option value="PBC">Public Benefit Corporation</option>
          </select>

          <label className="block mb-2">法人州:</label>
          <select
            className="w-full border p-2 mb-4"
            value={stateOfIncorp}
            onChange={(e) => setStateOfIncorp(e.target.value)}
          >
            <option value="">選択してください</option>
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
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={handleSave}
        disabled={loading}
      >
        保存
      </button>

      {message && <div className="mt-4">{message}</div>}
    </div>
  )
}

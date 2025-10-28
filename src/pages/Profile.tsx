import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Profile() {
  const [entityType, setEntityType] = useState<string>('')
  const [stateOfIncorp, setStateOfIncorp] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // プロフィールを保存する関数
  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setErrorMsg('')
    // 現在のユーザーIDを取得
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) {
      setErrorMsg('ユーザーが見つかりません')
      setLoading(false)
      return
    }
    // upsert 用のオブジェクト（idを含める）
    const updates = {
      id: user.id,
      us_entity_type: entityType,
      us_state_of_incorporation: stateOfIncorp,
      updated_at: new Date().toISOString(),
    }
    // profiles テーブルへ upsert 実行
    const { error } = await supabase
      .from('profiles')
      .upsert(updates)
    if (error) {
      // エラー表示（Supabase公式例では alert で表示）:contentReference[oaicite:1]{index=1}
      setErrorMsg(error.message)
      console.error('Profile update error:', error)
    } else {
      // 保存成功時は必要に応じてメッセージ等を表示
      console.log('Profile updated successfully')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSaveProfile}>
      <div>
        <label htmlFor="entityType">Entity Type</label>
        <input
          id="entityType"
          type="text"
          placeholder="Enter entity type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="stateOfIncorp">State of Incorporation</label>
        <input
          id="stateOfIncorp"
          type="text"
          placeholder="Enter state of incorporation"
          value={stateOfIncorp}
          onChange={(e) => setStateOfIncorp(e.target.value)}
        />
      </div>
      <div>
        <button type="submit" disabled={loading}>
          {loading ? '保存中...' : '保存'}
        </button>
      </div>
      {/* エラーがある場合は画面に表示 */}
      {errorMsg && <p className="error">エラー: {errorMsg}</p>}
    </form>
  )
}

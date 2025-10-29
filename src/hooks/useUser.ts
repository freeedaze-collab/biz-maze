import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type SessionUser = {
  id: string
  email?: string
  [k: string]: any
} | null

export function useUser() {
  const [user, setUser] = useState<SessionUser>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      setLoading(true)
      const { data } = await supabase.auth.getSession()
      if (mounted) {
        setUser(data.session?.user ?? null)
        setLoading(false)
      }
    }

    // 初期化
    init()

    // onAuthStateChange で追従
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}

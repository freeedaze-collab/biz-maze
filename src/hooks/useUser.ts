import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function useUser() {
  const [user, setUser] = useState<null | { id: string }>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setUser(session?.user ?? null)
      setLoading(false)
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  return { user, loading }
}

// src/lib/supabaseClient.ts
// 既存の重複を解消して、統一した Supabase クライアントを再エクスポート
export { supabase } from '../integrations/supabase/client'

// 型が必要な場合は integrations 側の types を再エクスポート
export type { Database } from '../integrations/supabase/types'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})


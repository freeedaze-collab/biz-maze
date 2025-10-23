// src/lib/supabaseClient.ts
// 既存の重複を解消して、統一した Supabase クライアントを再エクスポート
export { supabase } from '../integrations/supabase/client'

// 型が必要な場合は integrations 側の types を再エクスポート
export type { Database } from '../integrations/supabase/types'

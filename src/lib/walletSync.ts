// src/lib/walletSync.ts
import { authHeaders } from '@/lib/supabaseClient'

export type SyncResult = { ok: boolean; imported?: number; message?: string }

export async function triggerWalletSync(chain: 'polygon' | 'amoy' | 'mainnet' = 'polygon'): Promise<SyncResult> {
  const headers = await authHeaders(true) // ✅ セッション優先
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-wallet-transactions`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chain }),
  })
  if (!res.ok) return { ok: false, message: await res.text() }
  const json = await res.json().catch(() => ({}))
  return { ok: true, imported: json?.imported ?? 0 }
}

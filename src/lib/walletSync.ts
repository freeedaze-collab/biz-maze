// src/lib/walletSync.ts
import { supabase } from './supabaseClient'

export type SyncResult = {
  ok: boolean
  imported?: number
  message?: string
}

export async function triggerWalletSync(chain: 'polygon' | 'amoy' | 'mainnet' = 'polygon'): Promise<SyncResult> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error) throw error
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-wallet-transactions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chain }),
  })
  if (!res.ok) {
    return { ok: false, message: await res.text() }
  }
  const json = await res.json().catch(() => ({}))
  return { ok: true, imported: json?.imported ?? 0 }
}

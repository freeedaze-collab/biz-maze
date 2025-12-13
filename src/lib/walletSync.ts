// src/lib/walletSync.ts
import { supabase } from './supabaseClient'

export type SyncResult = {
  ok: boolean
  imported?: number
  message?: string
}

// [修正] 第一引数に walletAddress を追加
export async function triggerWalletSync(walletAddress: string, chain: 'polygon' | 'amoy' | 'mainnet' = 'polygon'): Promise<SyncResult> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error) throw error
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')

  // [修正] walletAddress がないとエラーにする
  if (!walletAddress) {
    return { ok: false, message: 'Wallet address is not provided.' }
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-wallet-transactions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    // [修正] リクエストボディに walletAddress を含める
    body: JSON.stringify({ walletAddress, chain }),
  })
  if (!res.ok) {
    const errorText = await res.text()
    console.error("Wallet sync failed:", errorText)
    return { ok: false, message: errorText }
  }
  const json = await res.json().catch(() => ({}))
  return { ok: true, imported: json?.imported ?? 0 }
}


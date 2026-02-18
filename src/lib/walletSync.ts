// src/lib/walletSync.ts
import { supabase } from './supabaseClient'

export type SyncResult = {
  ok: boolean
  imported?: number
  message?: string
}

// [修正] 第一引数に walletAddress を追加、bitcoin と solana を追加
export async function triggerWalletSync(
  walletAddress: string,
  chain: 'polygon' | 'amoy' | 'mainnet' | 'bitcoin' | 'solana' = 'polygon'
): Promise<SyncResult> {
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

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is missing.')

  // Use unified sync function - it auto-detects address type (Bitcoin/Solana/EVM)
  // and handles all chains accordingly
  const functionName = 'sync-wallet-transactions'
  const body = {
    walletAddress,
    // Optional: pass chain hint for EVM networks, but function will auto-detect if omitted
    ...(chain !== 'bitcoin' && chain !== 'solana' ? { chain } : {})
  }

  const url = `${supabaseUrl}/functions/v1/${functionName}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errorText = await res.text()
    console.error(`${chain} wallet sync failed:`, errorText)
    return { ok: false, message: errorText }
  }
  const json = await res.json().catch(() => ({}))
  return { ok: true, imported: json?.imported ?? 0 }
}



// src/lib/syncAll.ts
import { supabase } from './supabaseClient'

export type SyncItemResult = {
    type: 'wallet' | 'exchange'
    identifier: string
    status: 'success' | 'failed'
    message?: string
    imported?: number
}

export type SyncAllResult = {
    ok: boolean
    walletsProcessed: number
    walletsSuccess: number
    walletsFailed: number
    exchangesProcessed: number
    exchangesSuccess: number
    exchangesFailed: number
    details: SyncItemResult[]
}

/**
 * Trigger synchronization of all user data (wallets and/or exchanges)
 * @param syncType - 'wallets', 'exchanges', or 'all'
 * @returns Detailed sync results
 */
export async function triggerSyncAll(
    syncType: 'wallets' | 'exchanges' | 'all' = 'all'
): Promise<SyncAllResult> {
    const {
        data: { session },
        error,
    } = await supabase.auth.getSession()

    if (error) throw error
    const token = session?.access_token
    if (!token) throw new Error('Not authenticated')

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is missing.')

    const url = `${supabaseUrl}/functions/v1/sync-all-user-data`
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ syncType }),
    })

    if (!res.ok) {
        const errorText = await res.text()
        console.error('Sync all failed:', errorText)
        throw new Error(errorText)
    }

    const result: SyncAllResult = await res.json()
    return result
}

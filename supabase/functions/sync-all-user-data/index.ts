// supabase/functions/sync-all-user-data/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncItemResult {
    type: 'wallet' | 'exchange'
    identifier: string
    status: 'success' | 'failed'
    message?: string
    imported?: number
}

interface SyncAllResult {
    ok: boolean
    walletsProcessed: number
    walletsSuccess: number
    walletsFailed: number
    exchangesProcessed: number
    exchangesSuccess: number
    exchangesFailed: number
    details: SyncItemResult[]
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get auth token and create authenticated Supabase client
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing authorization header')
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Using service role to trigger other functions
        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } },
        })

        // Verify user authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            throw new Error('Unauthorized')
        }

        // Parse request body
        const { syncType = 'all' } = await req.json().catch(() => ({}))

        const result: SyncAllResult = {
            ok: true,
            walletsProcessed: 0,
            walletsSuccess: 0,
            walletsFailed: 0,
            exchangesProcessed: 0,
            exchangesSuccess: 0,
            exchangesFailed: 0,
            details: [],
        }

        // Sync wallets if requested
        if (syncType === 'all' || syncType === 'wallets') {
            await syncWallets(user.id, supabase, authHeader, result)
        }

        // Sync exchanges if requested
        if (syncType === 'all' || syncType === 'exchanges') {
            await syncExchanges(user.id, supabase, authHeader, result)
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('Sync all error:', error)
        return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})

async function syncWallets(
    userId: string,
    supabase: any,
    authHeader: string,
    result: SyncAllResult
) {
    // Fetch user's wallet connections
    const { data: wallets, error } = await supabase
        .from('wallet_connections')
        .select('id, wallet_address, wallet_type')
        .eq('user_id', userId)

    if (error) {
        console.error('Failed to fetch wallets:', error)
        return
    }

    if (!wallets || wallets.length === 0) {
        return
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    // Process wallets in parallel (with concurrency limit of 5)
    const batchSize = 5
    for (let i = 0; i < wallets.length; i += batchSize) {
        const batch = wallets.slice(i, i + batchSize)
        const promises = batch.map(wallet => syncSingleWallet(wallet, supabaseUrl, authHeader, userId))
        const batchResults = await Promise.all(promises)

        for (const syncResult of batchResults) {
            result.walletsProcessed++
            result.details.push(syncResult)
            if (syncResult.status === 'success') {
                result.walletsSuccess++
            } else {
                result.walletsFailed++
            }
        }
    }
}

const SUPPORTED_CHAINS = [
    { id: '0x1', name: 'eth' },
    { id: '0x38', name: 'bsc' },
    { id: '0x89', name: 'polygon' },
    { id: '0xa4b1', name: 'arbitrum' },
    { id: '0xa', name: 'optimism' },
    { id: '0xa86a', name: 'avalanche' },
    { id: '0x2105', name: 'base' },
    { id: '0xfa', name: 'fantom' },
];

async function syncSingleWallet(
    wallet: any,
    supabaseUrl: string,
    authHeader: string,
    userId: string
): Promise<SyncItemResult> {
    const { wallet_address } = wallet

    try {
        // Call sync-wallet-transactions once per wallet (no chainId = sync all supported chains)
        const url = `${supabaseUrl}/functions/v1/sync-wallet-transactions`
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ walletAddress: wallet_address, userId: userId }),
        })

        const responseText = await response.text()
        let data: any = {}
        try { data = JSON.parse(responseText) } catch { /* ignore */ }

        if (!response.ok) {
            console.error(`[SYNC-ALL] Wallet sync failed for ${wallet_address}: HTTP ${response.status} - ${responseText}`)
            return {
                type: 'wallet',
                identifier: wallet_address,
                status: 'failed',
                message: `HTTP ${response.status}: ${responseText.substring(0, 200)}`,
                imported: 0
            }
        }

        const totalInserted = data.totalInserted || 0
        const chainSummary = data.chains
            ? data.chains.map((c: any) => `${c.chain}:${c.inserted || 0}`).join(', ')
            : 'no chain details'

        console.log(`[SYNC-ALL] Wallet ${wallet_address}: ${totalInserted} txs (${chainSummary})`)

        return {
            type: 'wallet',
            identifier: wallet_address,
            status: 'success',
            imported: totalInserted,
            message: `Synced ${totalInserted} txs. Chains: ${chainSummary}`,
        }
    } catch (e: any) {
        console.error(`[SYNC-ALL] Wallet sync exception for ${wallet_address}:`, e.message)
        return {
            type: 'wallet',
            identifier: wallet_address,
            status: 'failed',
            message: e.message,
            imported: 0
        }
    }
}


async function syncExchanges(
    userId: string,
    supabase: any,
    authHeader: string,
    result: SyncAllResult
) {
    const { data: exchanges, error } = await supabase
        .from('exchange_connections')
        .select('id, exchange')
        .eq('user_id', userId)

    if (error || !exchanges) {
        console.error('Failed to fetch exchanges:', error)
        return
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    for (const exchange of exchanges) {
        const syncResult = await syncSingleExchange(exchange, supabaseUrl, authHeader)
        result.exchangesProcessed++
        result.details.push(syncResult)
        if (syncResult.status === 'success') {
            result.exchangesSuccess++
        } else {
            result.exchangesFailed++
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Post-sync valuation refresh
    console.log('[SYNC-ALL] Triggering valuation refresh (rates and prices)...')
    try {
        await Promise.all([
            fetch(`${supabaseUrl}/functions/v1/sync-historical-exchange-rates`, {
                method: 'POST',
                headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            }),
            fetch(`${supabaseUrl}/functions/v1/update-prices`, {
                method: 'POST',
                headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })
        ])
    } catch (e) {
        console.warn('[SYNC-ALL] Valuation refresh warning:', e.message)
    }
}

async function syncSingleExchange(
    exchange: any,
    supabaseUrl: string,
    authHeader: string
): Promise<SyncItemResult> {
    const { exchange: exchange_name, id: connectionId } = exchange

    try {
        const functionName = 'exchange-sync-all'
        const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                connection_id: connectionId,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            return {
                type: 'exchange',
                identifier: exchange_name,
                status: 'failed',
                message: errorText,
            }
        }

        const data = await response.json()
        return {
            type: 'exchange',
            identifier: exchange_name,
            status: 'success',
            imported: data.count || 0,
            message: `Dispatched ${data.count || 0} tasks`,
        }
    } catch (error) {
        return {
            type: 'exchange',
            identifier: exchange_name,
            status: 'failed',
            message: error.message,
        }
    }
}

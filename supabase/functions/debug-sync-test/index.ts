import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Query actual constraints on wallet_transactions
    const { data: constraints, error: constraintError } = await supabase.rpc('exec_sql', {
        sql: `
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name = 'wallet_transactions'
                AND tc.table_schema = 'public'
            GROUP BY tc.constraint_name, tc.constraint_type
            ORDER BY tc.constraint_type, tc.constraint_name;
        `
    }).catch(() => ({ data: null, error: 'rpc not available' }))

    // Alternative: query pg_indexes
    const { data: indexes, error: indexError } = await supabase.rpc('exec_sql', {
        sql: `
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'wallet_transactions'
            AND schemaname = 'public';
        `
    }).catch(() => ({ data: null, error: 'rpc not available' }))

    // Try direct query via PostgREST
    const { data: pgConstraints } = await supabase
        .from('information_schema.table_constraints' as any)
        .select('constraint_name, constraint_type')
        .eq('table_name', 'wallet_transactions')
        .eq('table_schema', 'public')
        .catch(() => ({ data: null }))

    return new Response(JSON.stringify({
        constraints,
        constraintError,
        indexes,
        indexError,
        pgConstraints,
    }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
})


const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const results: any = {}
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const ethKey = Deno.env.get('ETHERSCAN_API_KEY') ?? ''

    // 1. Check environment variables
    results.env = {
        ETHERSCAN_API_KEY: ethKey ? `SET (starts with: ${ethKey.substring(0, 6)}...)` : 'NOT SET',
        SUPABASE_URL: supabaseUrl ? 'SET' : 'NOT SET',
    }

    // 2. Check DB - get user's wallet connections
    const authHeader = req.headers.get('Authorization')
    let userWalletAddress = ''
    try {
        if (authHeader) {
            const supabase = createClient(supabaseUrl, supabaseKey)
            const token = authHeader.replace('Bearer ', '')
            const { data: { user } } = await supabase.auth.getUser(token)
            if (user) {
                const { count } = await supabase
                    .from('wallet_transactions')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                results.db_wallet_tx_count = count

                const { data: wallets } = await supabase
                    .from('wallet_connections')
                    .select('wallet_address, wallet_type')
                    .eq('user_id', user.id)
                results.wallet_connections = wallets

                if (wallets && wallets.length > 0) {
                    userWalletAddress = wallets[0].wallet_address
                }

                // Check chain breakdown of existing transactions
                const { data: chainBreakdown } = await supabase
                    .from('wallet_transactions')
                    .select('chain')
                    .eq('user_id', user.id)
                    .limit(1000)
                const chainCounts: Record<string, number> = {}
                chainBreakdown?.forEach((tx: any) => {
                    chainCounts[tx.chain] = (chainCounts[tx.chain] || 0) + 1
                })
                results.tx_by_chain = chainCounts
            }
        }
    } catch (e: any) {
        results.db_check = { error: e.message }
    }

    // 3. Test ETH API with user's actual wallet (or vitalik as fallback)
    const testAddr = userWalletAddress || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
    results.test_address_used = testAddr

    try {
        const ethUrl = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${testAddr}&page=1&offset=5&sort=desc&apikey=${ethKey}`
        const ethRes = await fetch(ethUrl)
        const ethData = await ethRes.json()
        results.eth_api_test = {
            status: ethData.status,
            message: ethData.message,
            result_count: Array.isArray(ethData.result) ? ethData.result.length : ethData.result?.substring(0, 100),
            first_tx: Array.isArray(ethData.result) && ethData.result.length > 0 ? {
                hash: ethData.result[0].hash,
                blockNumber: ethData.result[0].blockNumber,
                timeStamp: ethData.result[0].timeStamp,
                value: ethData.result[0].value,
            } : null
        }
    } catch (e: any) {
        results.eth_api_test = { error: e.message }
    }

    // 4. Test Routescan (Avalanche) with user's actual wallet
    try {
        const avaxUrl = `https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api?module=account&action=txlist&address=${testAddr}&page=1&offset=5&sort=desc`
        const avaxRes = await fetch(avaxUrl)
        const avaxData = await avaxRes.json()
        results.avax_api_test = {
            status: avaxData.status,
            message: avaxData.message,
            result_count: Array.isArray(avaxData.result) ? avaxData.result.length : avaxData.result?.substring(0, 100),
        }
    } catch (e: any) {
        results.avax_api_test = { error: e.message }
    }

    // 5. Test calling sync-wallet-transactions directly and capture response
    if (userWalletAddress && authHeader) {
        try {
            const syncRes = await fetch(`${supabaseUrl}/functions/v1/sync-wallet-transactions`, {
                method: 'POST',
                headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: userWalletAddress, chainId: '0x1' }) // ETH only
            })
            const syncData = await syncRes.json()
            results.sync_eth_test = {
                http_status: syncRes.status,
                response: syncData
            }
        } catch (e: any) {
            results.sync_eth_test = { error: e.message }
        }
    }

    return new Response(JSON.stringify(results, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
})

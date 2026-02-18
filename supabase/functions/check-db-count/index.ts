import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: wallets } = await supabase.from('wallet_connections').select('wallet_address, user_id')
    const { data: txs } = await supabase.from('wallet_transactions').select('tx_hash, chain, user_id')

    return new Response(JSON.stringify({
        walletCount: wallets?.length,
        wallets,
        txCount: txs?.length,
        txs
    }), {
        headers: { 'Content-Type': 'application/json' }
    })
})

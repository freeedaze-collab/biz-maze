
// supabase/functions/sync-wallet-transactions/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const COVALENT_API_KEY = Deno.env.get("COVALENT_API_KEY")
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
        const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''))
        if (!user) throw new Error('User not found')

        const { data: wallets, error: walletError } = await supabaseAdmin.from('wallets').select('address, chain_id').eq('user_id', user.id)
        if (walletError) throw walletError

        for (const wallet of wallets) {
            const { address: walletAddress, chain_id: numericChainId } = wallet

            const url = `https://api.covalenthq.com/v1/${numericChainId}/address/${walletAddress}/transactions_v3/?key=${COVALENT_API_KEY}`
            const response = await fetch(url)
            const { data } = await response.json()

            if (!data || !data.items) continue

            const getDirection = (from, to) => from.toLowerCase() === walletAddress.toLowerCase() ? 'out' : (to.toLowerCase() === walletAddress.toLowerCase() ? 'in' : 'self')

            const transactionsToUpsert = data.items.flatMap(item => {
                // ネイティブ通貨とERC20トークンの両方を考慮
                const processTx = (item, amount, symbol, valueQuote, from, to) => ({
                    user_id: user.id,
                    wallet_address: walletAddress.toLowerCase(),
                    chain_id: numericChainId,
                    direction: getDirection(from, to),
                    tx_hash: item.tx_hash,
                    block_number: item.block_height,
                    timestamp: item.block_signed_at,
                    from_address: from,
                    to_address: to,
                    value_wei: amount,
                    asset_symbol: symbol,
                    raw: item,
                    // ★★★【最終修正】★★★ 正しい value_usd カラムにUSD換算額を格納
                    value_usd: valueQuote
                });

                const records = [];
                // ネイティブ通貨のトランザクション
                if (item.value !== "0") {
                    records.push(processTx(item, item.value, item.gas_metadata.contract_ticker_symbol, item.value_quote, item.from_address, item.to_address));
                }

                // ERC20トークンのトランザクション
                item.log_events.forEach(log => {
                    if (log.decoded?.name === "Transfer" && log.decoded?.params) {
                        const from = log.decoded.params.find(p => p.name === 'from')?.value;
                        const to = log.decoded.params.find(p => p.name === 'to')?.value;
                        const value = log.decoded.params.find(p => p.name === 'value')?.value;
                        if(from && to && value) {
                            records.push(processTx(item, value, log.sender_contract_ticker_symbol, log.value_quote, from, to));
                        }
                    }
                });
                return records;
            });

            if(transactionsToUpsert.length > 0) {
                const { error } = await supabaseAdmin.from('wallet_transactions').upsert(transactionsToUpsert, { onConflict: 'tx_hash' })
                if (error) throw error
            }
        }

        return new Response(JSON.stringify({ message: `Wallet sync complete.` }), { headers: corsHeaders });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});

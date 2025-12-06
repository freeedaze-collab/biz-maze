
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
        if (!wallets) return new Response(JSON.stringify({ message: "No wallets found for this user." }), { headers: corsHeaders });

        for (const wallet of wallets) {
            const { address: walletAddress, chain_id: numericChainId } = wallet

            const url = `https://api.covalenthq.com/v1/${numericChainId}/address/${walletAddress}/transactions_v3/?key=${COVALENT_API_KEY}`
            const response = await fetch(url)
            const { data } = await response.json()

            if (!data || !data.items) continue

            const getDirection = (from, to) => from.toLowerCase() === walletAddress.toLowerCase() ? 'out' : (to.toLowerCase() === walletAddress.toLowerCase() ? 'in' : 'self')

            const transactionsToUpsert = data.items.flatMap(item => {
                const processTx = (txItem, amount, symbol, valueQuote, from, to) => ({
                    user_id: user.id,
                    wallet_address: walletAddress.toLowerCase(),
                    chain_id: numericChainId,
                    direction: getDirection(from, to),
                    tx_hash: txItem.tx_hash,
                    block_number: txItem.block_height,
                    timestamp: txItem.block_signed_at,
                    from_address: from,
                    to_address: to,
                    value_wei: amount,
                    asset_symbol: symbol,
                    raw: txItem,
                    // ★★★【USD換算修正】★★★ Covalentからの値がない場合はnullを設定
                    value_usd: valueQuote ?? null
                });

                const records = [];
                // ネイティブ通貨のトランザクション
                if (item.value !== "0") {
                    records.push(processTx(item, item.value, item.gas_metadata?.contract_ticker_symbol, item.value_quote, item.from_address, item.to_address));
                }

                // ★★★【墜落回避】★★★ log_eventsがnullの場合を考慮し、オプショナルチェーン(?.)を追加
                item.log_events?.forEach(log => {
                    if (log.decoded?.name === "Transfer" && log.decoded?.params) {
                        const from = log.decoded.params.find(p => p.name === 'from')?.value;
                        const to = log.decoded.params.find(p => p.name === 'to')?.value;
                        const value = log.decoded.params.find(p => p.name === 'value')?.value;
                        if(from && to && value) {
                            // `log.value_quote` を `value_usd` のために渡す
                            records.push(processTx(item, value, log.sender_contract_ticker_symbol, log.value_quote, from, to));
                        }
                    }
                });
                return records;
            });
            
            // 注意: 現在の実装では、1つのオンチェーントランザクション(tx_hash)に複数のトークン転送が含まれる場合、
            // onConflict: 'tx_hash' のため、最後の1レコードのみが保存されます。これはデータ損失につながる可能性があります。
            // wallet_transactionsテーブルの主キーをtx_hash以外（例：自動採番ID）にすることを強く推奨します。
            if(transactionsToUpsert.length > 0) {
                const { error } = await supabaseAdmin.from('wallet_transactions').upsert(transactionsToUpsert, { onConflict: 'tx_hash' })
                if (error) {
                    console.error('Upsert failed:', error)
                    throw error
                }
            }
        }

        return new Response(JSON.stringify({ message: `Wallet sync complete.` }), { headers: corsHeaders });

    } catch (err) {
        console.error("Unhandled error in sync-wallet-transactions:", err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});

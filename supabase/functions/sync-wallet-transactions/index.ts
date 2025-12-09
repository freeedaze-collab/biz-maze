// supabase/functions/sync-wallet-transactions/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const corsHeaders = { /* ... */ }; // 変更なし
const CHAIN_ID_MAP: Record<string, number> = { /* ... */ }; // 変更なし
const COVALENT_CHAIN_NAME_MAP: Record<string, string> = { /* ... */ }; // 変更なし

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') { /* ... */ }
  try {
    const { walletAddress, chain } = await req.json();
    const numericChainId = CHAIN_ID_MAP[chain.toLowerCase()];
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized.');
    
    const covalentChainName = COVALENT_CHAIN_NAME_MAP[chain.toLowerCase()];
    const url = `https://api.covalenthq.com/v1/${covalentChainName}/address/${walletAddress}/transactions_v2/?key=${Deno.env.get('COVALENT_API_KEY')!}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Covalent API Error: ${await response.text()}`);
    const result = await response.json();
    
    const transactionsToUpsert = [];
    for (const tx of result.data.items) {
        if (!tx.successful) continue;
        const getDirection = (from: string, to: string) => walletAddress.toLowerCase() === from.toLowerCase() ? 'out' : 'in';

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
            // [最終修正] 正しいカラムにUSD換算額を格納
            usd_value_at_tx: valueQuote
        });

        // ERC20 Transfers
        for (const log of tx.log_events) {
            if (log.decoded?.name === "Transfer") {
                const value = log.decoded.params.find(p => p.name === 'value')?.value;
                if (value && value !== '0') {
                    transactionsToUpsert.push(processTx(tx, parseFloat(value), log.sender_contract_ticker_symbol, log.value_quote, log.decoded.params.find(p=>p.name==='from').value, log.decoded.params.find(p=>p.name==='to').value));
                }
            }
        }
        // Native Transfers
        if (tx.value !== "0" && !tx.log_events.some(log => log.decoded?.name === "Transfer")) {
             transactionsToUpsert.push(processTx(tx, parseFloat(tx.value), tx.gas_metadata.contract_ticker_symbol, tx.value_quote, tx.from_address, tx.to_address));
        }
    }
    
    if (transactionsToUpsert.length === 0) { /* ... */ }

    const { data, error } = await supabaseAdmin
      .from('wallet_transactions') // 正しいテーブル名
      .upsert(transactionsToUpsert, { onConflict: 'tx_hash' })
      .select();

    if (error) throw error;
    return new Response(JSON.stringify({ message: 'Sync successful.', count: data?.length ?? 0 }), { /* ... */ });
  } catch (err) { /* ... */ }
});

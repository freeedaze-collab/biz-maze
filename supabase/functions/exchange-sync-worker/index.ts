
// supabase/functions/exchange-sync-worker/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Exchange, Trade, Transaction, Transfer } from 'https://esm.sh/ccxt@4.3.40'
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getCcxtInstance(user_id: string, exchangeName: string, supabaseAdmin: SupabaseClient): Promise<Exchange> {
    console.log(`[WORK] Getting CCXT for user: ${user_id}, exchange: ${exchangeName}`);
    const { data, error } = await supabaseAdmin.from('exchange_connections').select('id, api_key_encrypted').eq('user_id', user_id).eq('exchange', exchangeName).single();
    if (error || !data) {
        console.error(`[WORK] API key retrieval error for ${exchangeName}:`, error);
        throw new Error(`Connection not found for ${exchangeName}`);
    }
    const p = data.api_key_encrypted.split(":");
    const k = await crypto.subtle.importKey("raw", Uint8Array.from(atob(Deno.env.get("EDGE_KMS_KEY")!), c => c.charCodeAt(0)), "AES-GCM", false, ["decrypt"]);
    const d = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(p[1]) }, k, decode(p[2]));
    const credentials = JSON.parse(new TextDecoder().decode(d));
    // @ts-ignore
    const ccxt = await import('https://esm.sh/ccxt@4.3.40');
    // @ts-ignore
    const exchangeInstance = new ccxt[exchangeName]({ apiKey: credentials.apiKey, secret: credentials.apiSecret, password: credentials.apiPassphrase });
    return exchangeInstance;
}

// ★★★【米ドル換算ロジック追加】★★★
async function handleTradeSync(user_id: string, exchange: string, symbol: string, supabaseAdmin: SupabaseClient, ccxt: Exchange): Promise<number> {
    console.log(`[WORK] Fetching trades for ${symbol}...`);
    const { data: since } = await supabaseAdmin.rpc('get_last_trade_ts_for_symbol', { p_user_id: user_id, p_exchange: exchange, p_symbol: symbol });
    const trades: Trade[] = await ccxt.fetchMyTrades(symbol, since || undefined);
    if (trades.length === 0) return 0;

    console.log(`[WORK] Found ${trades.length} new trades for ${symbol}. Saving...`);
    const usdStables = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP'];

    const records = trades.map((t: Trade) => {
        const quoteCurrency = t.symbol.split('/')[1];
        const value_usd = (t.cost && quoteCurrency && usdStables.includes(quoteCurrency)) ? t.cost : null;

        return {
            user_id: user_id,
            exchange: exchange,
            trade_id: t.id,
            order_id: t.order,
            symbol: t.symbol,
            ts: t.datetime,
            price: t.price,
            amount: t.amount,
            cost: t.cost,
            fee_cost: t.fee?.cost,
            fee_currency: t.fee?.currency,
            side: t.side,
            value_usd: value_usd, // ★ USD換算値を追加
            raw: t,
        }
    });
    const { error } = await supabaseAdmin.from('exchange_trades').upsert(records, { onConflict: 'user_id,exchange,trade_id' });
    if (error) throw new Error(`DB save failed for ${symbol}: ${error.message}`);
    return records.length;
}

async function handleNonTradeSync(user_id: string, exchange: string, supabaseAdmin: SupabaseClient, ccxt: Exchange): Promise<number> {
    let totalSaved = 0;
    try {
        if (ccxt.has['fetchDeposits']) {
            const { data: since } = await supabaseAdmin.rpc('get_last_deposit_ts', { p_user_id: user_id, p_exchange: exchange });
            const deposits: Transaction[] = await ccxt.fetchDeposits(undefined, since || undefined);
            if (deposits.length > 0) {
                const records = deposits.map(d => ({ user_id, exchange, asset: d.currency, amount: d.amount, ts: d.datetime, tx_hash: d.txid, raw: d }));
                const { error } = await supabaseAdmin.from('exchange_deposits').upsert(records, { onConflict: 'user_id,exchange,tx_hash' });
                if (error) console.error(`[WORK-DB] Deposit save error: ${error.message}`); else totalSaved += records.length;
            }
        }
    } catch (e) { console.warn(`[WORK-DEPOSIT-FAIL] ${e.message}`) }
    try {
        if (ccxt.has['fetchWithdrawals']) {
            const { data: since } = await supabaseAdmin.rpc('get_last_withdrawal_ts', { p_user_id: user_id, p_exchange: exchange });
            const withdrawals: Transaction[] = await ccxt.fetchWithdrawals(undefined, since || undefined);
            if (withdrawals.length > 0) {
                const records = withdrawals.map(w => ({ user_id, exchange, asset: w.currency, amount: w.amount, ts: w.datetime, tx_hash: w.txid, raw: w }));
                const { error } = await supabaseAdmin.from('exchange_withdrawals').upsert(records, { onConflict: 'user_id,exchange,tx_hash' });
                if (error) console.error(`[WORK-DB] Withdrawal save error: ${error.message}`); else totalSaved += records.length;
            }
        }
    } catch (e) { console.warn(`[WORK-WITHDRAW-FAIL] ${e.message}`) }
    try {
        if (ccxt.has['fetchTransfers']) {
            const { data: since } = await supabaseAdmin.rpc('get_last_transfer_ts', { p_user_id: user_id, p_exchange: exchange });
            const transfers: Transfer[] = await ccxt.fetchTransfers(undefined, since || undefined);
             if (transfers.length > 0) {
                const records = transfers.map(t => ({ user_id, exchange, asset: t.currency, amount: t.amount, ts: t.datetime, from_account: t.fromAccount, to_account: t.toAccount, raw: t }));
                const { error } = await supabaseAdmin.from('exchange_transfers').upsert(records, { onConflict: 'user_id,exchange,ts,asset,amount' });
                if (error) console.error(`[WORK-DB] Transfer save error: ${error.message}`); else totalSaved += records.length;
            }
        }
    } catch (e) { console.warn(`[WORK-TRANSFER-FAIL] ${e.message}`) }
    return totalSaved;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    let final_user_id: string | null = null;
    try {
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
        const { exchange, symbol, task_type, user_id } = await req.json();
        if (user_id) { final_user_id = user_id; } else {
            const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
            if (userError || !user) throw new Error('User not found from token.');
            final_user_id = user.id;
        }
        if (!final_user_id) throw new Error('Critical: User ID could not be determined.');
        if (!exchange || !task_type) throw new Error('exchange and task_type are required.');
        const ccxt = await getCcxtInstance(final_user_id, exchange, supabaseAdmin);
        await ccxt.loadMarkets();
        let savedCount = 0;
        if (task_type === 'trade') {
            if (!symbol) throw new Error('Symbol is required for trade sync.');
            savedCount = await handleTradeSync(final_user_id, exchange, symbol, supabaseAdmin, ccxt);
        } else if (task_type === 'non-trade') {
            savedCount = await handleNonTradeSync(final_user_id, exchange, supabaseAdmin, ccxt);
        } else { throw new Error(`Unknown task_type: ${task_type}`); }
        return new Response(JSON.stringify({ savedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    } catch (err) {
        console.error(`[WORK-CRASH]`, { error: err.message, stack: err.stack });
        return new Response(JSON.stringify({ error: `Unhandled exception: ${err.message}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});

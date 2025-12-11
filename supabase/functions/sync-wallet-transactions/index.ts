
// supabase/functions/sync-wallet-transactions/index.ts
// FINAL VERSION 2: Uses import_map to resolve shared modules.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { CovalentClient } from "https://esm.sh/@covalenthq/client-sdk@1.0.0";
import { Env, SUPPORTED_CHAINS } from "shared/types.ts"; // <<< FIX: Using import_map path

// --- CORS Helper ---
function cors(res: Response) {
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  return new Response(res.body, { status: res.status, headers: h });
}

const getDirection = (walletAddress: string, fromAddress: string, toAddress: string): 'in' | 'out' => {
    const walletAddr = walletAddress.toLowerCase();
    const fromAddr = fromAddress?.toLowerCase();
    const toAddr = toAddress?.toLowerCase();
    
    if (fromAddr === walletAddr && toAddr === walletAddr) return 'in';
    if (fromAddr === walletAddr) return 'out';
    if (toAddr === walletAddr) return 'in';
    return 'out';
};

async function syncWallet(supabaseAdmin: SupabaseClient, covalentClient: CovalentClient, user: any, connection: any) {
    const { wallet_address, chain_id } = connection;
    const chainName = SUPPORTED_CHAINS[chain_id];
    if (!chainName) {
        console.warn(`Unsupported chain_id: ${chain_id} for wallet ${wallet_address}`);
        return;
    }

    console.log(`Processing wallet ${wallet_address} on chain ${chainName}`);

    try {
        const resp = await covalentClient.TransactionService.getAllTransactionsForAddress(chainName, wallet_address);
        if (resp.error) {
            throw new Error(`Covalent API error: ${resp.error_message}`);
        }

        if (!resp.data || !resp.data.items || resp.data.items.length === 0) {
            console.log(`No new transactions for wallet ${wallet_address} on ${chainName}.`);
        } else {
            const numericChainId = Number(chain_id);
            
            const processTx = (item: any, amount: string, symbol: string, valueQuote: number, from: string, to: string) => {
                if (!item || !amount || !symbol || from === undefined || to === undefined) return null;
                return {
                    user_id: user.id,
                    wallet_address: wallet_address.toLowerCase(),
                    chain_id: numericChainId,
                    direction: getDirection(wallet_address, from, to),
                    tx_hash: item.tx_hash,
                    block_number: item.block_height,
                    timestamp: item.block_signed_at,
                    from_address: from,
                    to_address: to,
                    value_wei: amount,
                    asset_symbol: symbol,
                    usd_value_at_tx: valueQuote,
                    raw: item,
                };
            };

            const records = resp.data.items.flatMap((item: any) => {
                const recordsToInsert = [];
                if (item.value && item.value !== '0') {
                    const mainTxRecord = processTx(item, item.value, item.gas_metadata?.contract_ticker_symbol || 'ETH', item.value_quote, item.from_address, item.to_address);
                    if(mainTxRecord) recordsToInsert.push(mainTxRecord);
                }
                if (item.log_events) {
                    for (const log of item.log_events) {
                        const decoded = log.decoded;
                        if (decoded && (decoded.name === 'Transfer' || decoded.name === 'transfer')) {
                            const params = decoded.params.reduce((acc, p) => ({ ...acc, [p.name]: p.value }), {} as any);
                            const logRecord = processTx(item, params.value, log.sender_contract_ticker_symbol, params.value_quote, params.from, params.to);
                            if(logRecord) recordsToInsert.push(logRecord);
                        }
                    }
                }
                return recordsToInsert;
            }).filter(Boolean);

            if (records.length > 0) {
                const { error: upsertError } = await supabaseAdmin.from('wallet_transactions').upsert(records, {
                    onConflict: 'tx_hash,wallet_address,chain_id,direction,asset_symbol'
                });
                if (upsertError) {
                    console.error(`Supabase upsert error for wallet ${wallet_address}:`, upsertError);
                    throw upsertError;
                }
            }
        }

        await supabaseAdmin.from('wallet_connections').update({ last_synced: new Date().toISOString() }).eq('id', connection.id);

    } catch (e: any) {
        console.error(`Failed to process wallet ${wallet_address}. Error: ${e.message}`);
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return cors(new Response("ok"));
    }
    
    try {
        const authHeader = req.headers.get("Authorization")!;
        const jwt = authHeader.replace("Bearer ", "");

        const supabaseAdmin = createClient(Deno.env.get(Env.SupabaseUrl)!, Deno.env.get(Env.SupabaseServiceRoleKey)!);
        const covalentClient = new CovalentClient(Deno.env.get(Env.CovalentApiKey)!);

        const { data: { user } } = await supabaseAdmin.auth.getUser(jwt);
        if (!user) return cors(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));

        const { data: connections, error: connError } = await supabaseAdmin.from('wallet_connections').select('*').eq('user_id', user.id);
        if (connError) throw connError;

        await Promise.all(connections.map(conn => syncWallet(supabaseAdmin, covalentClient as any, user, conn)));

        return cors(new Response(JSON.stringify({ success: true })));

    } catch (e: any) {
        return cors(new Response(JSON.stringify({ error: e.message }), { status: 500 }));
    }
});

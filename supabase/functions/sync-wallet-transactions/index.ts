
// supabase/functions/sync-wallet-transactions/index.ts
// VERSION 3: Fetches all supported chains for a wallet in a single run.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANKR_CHAIN_NAMES = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism', 'avalanche'];
const CHAIN_ID_MAP: Record<string, number> = { 'ethereum': 1, 'polygon': 137, 'bsc': 56, 'arbitrum': 42161, 'optimism': 10, 'avalanche': 43114 };
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { walletAddress } = await req.json();
        if (!walletAddress) throw new Error('Missing walletAddress in request body.');

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('Unauthorized');

        const ANKR_API_KEY = Deno.env.get('ANKR_API_KEY');
        if (!ANKR_API_KEY) throw new Error('ANKR_API_KEY is not set.');
        
        console.log(`Fetching all chain transactions for ${walletAddress} via Ankr...`);

        const ankrRequestBody = {
            jsonrpc: "2.0",
            method: "ankr_getTransactionsByAddress",
            params: {
                address: walletAddress,
                blockchain: ANKR_CHAIN_NAMES, // [FIX] Pass all supported chains at once
                pageSize: 1000,
                descOrder: true,
                includeLogs: true, 
            },
            id: 1,
        };

        const response = await fetch(`https://rpc.ankr.com/multichain/${ANKR_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ankrRequestBody),
        });

        if (!response.ok) throw new Error(`Ankr API failed: ${response.statusText}`);

        const result = await response.json();
        if (result.error) throw new Error(`Ankr API Error: ${result.error.message}`);
        
        const transactions = result.result?.transactions || [];
        console.log(`Received ${transactions.length} total transactions from Ankr across all chains.`);

        if (transactions.length === 0) {
            return new Response(JSON.stringify({ message: 'No new transactions found.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        const transactionsToUpsert = transactions.map(tx => {
            const chainName = tx.blockchain;
            const numericChainId = CHAIN_ID_MAP[chainName];
            if (numericChainId === undefined) {
                 console.warn(`Skipping transaction with unknown chain: ${chainName}`);
                 return null;
            }
            return {
                user_id: user.id,
                wallet_address: walletAddress.toLowerCase(),
                chain_id: numericChainId,
                direction: walletAddress.toLowerCase() === tx.from.toLowerCase() ? 'out' : 'in',
                tx_hash: tx.hash,
                block_number: parseInt(tx.blockNumber, 16),
                timestamp: new Date(parseInt(tx.timestamp) * 1000).toISOString(),
                from_address: tx.from,
                to_address: tx.to,
                value_wei: tx.value, 
                asset_symbol: tx.tokenSymbol || chainName.toUpperCase(),
                value_usd: tx.valueInUsd, 
                raw_data: tx,
            };
        }).filter(Boolean); // Filter out any null entries from unknown chains
        
        if (transactionsToUpsert.length === 0) {
             return new Response(JSON.stringify({ message: 'No valid transactions to save.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`Upserting ${transactionsToUpsert.length} transactions...`);
        const { error: upsertError } = await supabaseAdmin.from('wallet_transactions').upsert(transactionsToUpsert, { onConflict: 'tx_hash' });

        if (upsertError) throw upsertError;

        console.log('Sync successful.');
        return new Response(JSON.stringify({ message: 'Sync successful.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
});


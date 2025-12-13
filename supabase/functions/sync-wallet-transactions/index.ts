
// supabase/functions/sync-wallet-transactions/index.ts
// VERSION 2: Adds `includeLogs` to the Ankr request to fetch token transfers.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- Mappings and Headers ---
const ANKR_CHAIN_NAME_MAP: Record<string, string> = { 'ethereum': 'eth', 'polygon': 'polygon', 'bsc': 'bsc', 'arbitrum': 'arbitrum', 'optimism': 'optimism', 'avalanche': 'avalanche' };
const CHAIN_ID_MAP: Record<string, number> = { 'ethereum': 1, 'polygon': 137, 'bsc': 56, 'arbitrum': 42161, 'optimism': 10, 'avalanche': 43114 };
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// --- Deno Edge Function ---
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { walletAddress, chain } = await req.json();
        if (!walletAddress || !chain) throw new Error('Missing walletAddress or chain in request body.');

        const ankrChainName = ANKR_CHAIN_NAME_MAP[chain.toLowerCase()];
        const numericChainId = CHAIN_ID_MAP[chain.toLowerCase()];
        if (!ankrChainName || !numericChainId) throw new Error(`Unsupported chain: ${chain}`);

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) throw new Error('Unauthorized: User not found.');

        // --- Ankr API Call ---
        const ANKR_API_KEY = Deno.env.get('ANKR_API_KEY');
        if (!ANKR_API_KEY) throw new Error('ANKR_API_KEY is not set in Supabase secrets.');
        
        console.log(`Fetching transactions for ${walletAddress} on ${ankrChainName} via Ankr...`);

        const ankrRequestBody = {
            jsonrpc: "2.0",
            method: "ankr_getTransactionsByAddress",
            params: {
                address: walletAddress,
                blockchain: [ankrChainName],
                pageSize: 1000,
                descOrder: true,      // Get latest transactions first
                includeLogs: true,    // [FIX] This is crucial for fetching token (ERC20, etc.) transfers
            },
            id: 1,
        };

        const response = await fetch(`https://rpc.ankr.com/multichain/${ANKR_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ankrRequestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Ankr API request failed: ${response.status} ${errorBody}`);
        }

        const result = await response.json();
        if (result.error) throw new Error(`Ankr API Error: ${result.error.message}`);
        
        // The actual list of transactions is in result.result.transactions
        const transactions = result.result?.transactions || [];
        console.log(`Received ${transactions.length} transactions from Ankr.`);

        if (transactions.length === 0) {
            return new Response(JSON.stringify({ message: 'No new transactions found.', count: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // --- Data Transformation & Upsert ---
        const transactionsToUpsert = transactions.map(tx => ({
            user_id: user.id,
            wallet_address: walletAddress.toLowerCase(),
            chain_id: numericChainId,
            direction: walletAddress.toLowerCase() === tx.from.toLowerCase() ? 'out' : 'in',
            tx_hash: tx.hash,
            block_number: parseInt(tx.blockNumber, 16),
            timestamp: new Date(parseInt(tx.timestamp) * 1000).toISOString(),
            from_address: tx.from,
            to_address: tx.to,
            value_wei: tx.value, // Native currency value
            asset_symbol: tx.tokenSymbol || tx.blockchain.toUpperCase(), // Use token symbol if available
            value_usd: tx.valueInUsd, 
            raw_data: tx, 
        }));
        
        console.log(`Upserting ${transactionsToUpsert.length} transactions to the database...`);
        const { data, error: upsertError } = await supabaseAdmin
            .from('wallet_transactions')
            .upsert(transactionsToUpsert, { onConflict: 'tx_hash' })
            .select();

        if (upsertError) {
            console.error('Database upsert error:', upsertError);
            throw upsertError;
        }

        console.log('Sync successful.');
        return new Response(JSON.stringify({ message: 'Sync successful.', count: data?.length ?? 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('[SYNC-WALLET-CRASH]', err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});


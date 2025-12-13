
// supabase/functions/sync-wallet-transactions/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- Static Mappings ---
// Maps readable chain names to Ankr's specific blockchain identifiers
const ANKR_CHAIN_NAME_MAP: Record<string, string> = {
    'ethereum': 'eth',
    'polygon': 'polygon',
    'bsc': 'bsc',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'avalanche': 'avalanche',
    // Add other chains supported by Ankr as needed
};

// Maps readable chain names to their numeric Chain IDs for database storage
const CHAIN_ID_MAP: Record<string, number> = {
    'ethereum': 1,
    'polygon': 137,
    'bsc': 56,
    'arbitrum': 42161,
    'optimism': 10,
    'avalanche': 43114,
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Deno Edge Function ---
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { walletAddress, chain } = await req.json();
        if (!walletAddress || !chain) {
            throw new Error('Missing walletAddress or chain in request body.');
        }

        const ankrChainName = ANKR_CHAIN_NAME_MAP[chain.toLowerCase()];
        const numericChainId = CHAIN_ID_MAP[chain.toLowerCase()];
        if (!ankrChainName || !numericChainId) {
            throw new Error(`Unsupported chain: ${chain}`);
        }

        // --- Supabase and User Authentication ---
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
        if (userError || !user) {
            throw new Error('Unauthorized: User not found.');
        }

        // --- Ankr API Call ---
        const ANKR_API_KEY = Deno.env.get('ANKR_API_KEY');
        if (!ANKR_API_KEY) {
            throw new Error('ANKR_API_KEY is not set in Supabase secrets.');
        }
        
        const ankrApiUrl = `https://rpc.ankr.com/multichain/${ANKR_API_KEY.substring(0, 8)}...`; // Use a placeholder or a real key part for logs
        console.log(`Fetching transactions for ${walletAddress} on ${ankrChainName} via Ankr...`);

        const response = await fetch(`https://rpc.ankr.com/multichain/${ANKR_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "ankr_getTransactionsByAddress",
                params: {
                    address: walletAddress,
                    blockchain: [ankrChainName], // Ankr API expects an array
                    pageSize: 1000, // Fetch up to 1000 transactions
                },
                id: 1,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Ankr API request failed: ${response.status} ${errorBody}`);
        }

        const result = await response.json();
        if (result.error) {
            throw new Error(`Ankr API Error: ${result.error.message}`);
        }
        
        const transactions = result.result?.transactions || [];
        console.log(`Received ${transactions.length} transactions from Ankr.`);

        if (transactions.length === 0) {
            return new Response(JSON.stringify({ message: 'No new transactions found.', count: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // --- Data Transformation ---
        const transactionsToUpsert = transactions.map(tx => {
            const direction = walletAddress.toLowerCase() === tx.from.toLowerCase() ? 'out' : 'in';
            // Ankr provides value in native currency format (e.g., 18 decimals for ETH)
            const valueWei = tx.value; 
            // Determine asset symbol. For token transfers, Ankr provides `tokenSymbol`. For native, it's the chain's currency.
            const assetSymbol = tx.tokenSymbol || tx.blockchain.toUpperCase();
            
            return {
                user_id: user.id,
                wallet_address: walletAddress.toLowerCase(),
                chain_id: numericChainId,
                direction: direction,
                tx_hash: tx.hash,
                block_number: parseInt(tx.blockNumber, 16), // Ankr blockNumber is hex
                timestamp: new Date(parseInt(tx.timestamp) * 1000).toISOString(),
                from_address: tx.from,
                to_address: tx.to,
                value_wei: valueWei,
                asset_symbol: assetSymbol,
                value_usd: tx.valueInUsd, // Use Ankr's USD value field
                raw_data: tx, // Store the full Ankr response for the transaction
            };
        });
        
        // --- Database Upsert ---
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

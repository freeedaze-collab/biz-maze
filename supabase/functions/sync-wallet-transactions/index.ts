
// supabase/functions/sync-wallet-transactions/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const nativeSymbols: { [key: string]: string } = {
    'eth': 'ETH',
    'polygon': 'MATIC',
    'bsc': 'BNB',
    'avalanche': 'AVAX',
    'arbitrum': 'ETH',
    'optimism': 'ETH'
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Authenticate user
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const jwt = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
        if (userError || !user) {
            return new Response(JSON.stringify({ error: userError?.message || 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 2. Get wallet address
        const { walletAddress } = await req.json();
        if (!walletAddress) {
            return new Response(JSON.stringify({ error: 'walletAddress is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 3. Check for Moralis API Key
        const MORALIS_API_KEY = Deno.env.get('MORALIS_API_KEY');
        if (!MORALIS_API_KEY) {
            console.warn(`MORALIS_API_KEY is not set. Skipping sync for wallet ${walletAddress}.`);
            return new Response(JSON.stringify({ message: 'Sync skipped: Moralis integration is not configured.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 4. Fetch transactions from Moralis for multiple chains
        console.log(`Starting Moralis sync for wallet: ${walletAddress}`);
        const supportedChains = ['eth', 'polygon', 'bsc', 'avalanche', 'arbitrum', 'optimism'];
        let recordsToUpsert: any[] = [];

        for (const chain of supportedChains) {
            console.log(`Fetching for chain: ${chain}`);
            
            // --- A: Get Native Currency Transactions ---
            const nativeTxUrl = `https://deep-index.moralis.io/api/v2.2/${walletAddress}?chain=${chain}`;
            const nativeResponse = await fetch(nativeTxUrl, { headers: { 'Accept': 'application/json', 'X-API-Key': MORALIS_API_KEY } });
            
            if (nativeResponse.ok) {
                const nativeData = await nativeResponse.json();
                const nativeTxs = nativeData.result.map((tx: any) => ({
                    user_id: user.id,
                    wallet_address: walletAddress,
                    tx_hash: tx.hash,
                    chain: chain,
                    date: new Date(tx.block_timestamp),
                    from_address: tx.from_address,
                    to_address: tx.to_address,
                    amount: parseFloat(tx.value) / (10 ** 18),
                    asset: nativeSymbols[chain] || 'UNKNOWN',
                    value_in_usd: null, // Moralis basic endpoints don't provide this directly
                    type: tx.from_address.toLowerCase() === walletAddress.toLowerCase() ? 'WITHDRAWAL' : 'DEPOSIT',
                    description: `Native transaction on ${chain}`,
                    source: 'wallet',
                }));
                recordsToUpsert.push(...nativeTxs);
            } else {
                 console.warn(`Moralis (Native) API call failed for chain ${chain}. Status: ${nativeResponse.status}`);
            }

            // --- B: Get ERC20 Token Transfers ---
            const erc20TxUrl = `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20/transfers?chain=${chain}`;
            const erc20Response = await fetch(erc20TxUrl, { headers: { 'Accept': 'application/json', 'X-API-Key': MORALIS_API_KEY } });

            if (erc20Response.ok) {
                const erc20Data = await erc20Response.json();
                const erc20Txs = erc20Data.result.map((tx: any) => ({
                    user_id: user.id,
                    wallet_address: walletAddress,
                    tx_hash: tx.transaction_hash,
                    chain: chain,
                    date: new Date(tx.block_timestamp),
                    from_address: tx.from_address,
                    to_address: tx.to_address,
                    amount: parseFloat(tx.value) / (10 ** parseInt(tx.token_decimals)),
                    asset: tx.token_symbol,
                    value_in_usd: null, // Moralis basic endpoints don't provide this directly
                    type: tx.from_address.toLowerCase() === walletAddress.toLowerCase() ? 'WITHDRAWAL' : 'DEPOSIT',
                    description: `ERC20 transfer of ${tx.token_name}`,
                    source: 'wallet',
                }));
                recordsToUpsert.push(...erc20Txs);
            } else {
                console.warn(`Moralis (ERC20) API call failed for chain ${chain}. Status: ${erc20Response.status}`);
            }
        }

        // 5. Upsert records to Supabase
        if (recordsToUpsert.length === 0) {
            return new Response(JSON.stringify({ message: 'No new transactions found.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        console.log(`Attempting to upsert ${recordsToUpsert.length} records...`);
        const { error: upsertError } = await supabaseClient.from('wallet_transactions').upsert(recordsToUpsert, { onConflict: 'tx_hash,user_id' });
        if (upsertError) {
            throw new Error(`Supabase upsert error: ${upsertError.message}`);
        }

        return new Response(JSON.stringify({ message: `Sync successful. ${recordsToUpsert.length} transactions processed.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error('CRITICAL ERROR in sync-wallet-transactions:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

// supabase/functions/sync-wallet-transactions/index.ts
// ROBUST VERSION 3: Implements a fallback using the 'asset_prices' table with current prices.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const ANKR_API_KEY = Deno.env.get('ANKR_API_KEY') ?? '';
const chainIdMap: { [key: string]: number } = { eth: 1, polygon: 137, bsc: 56, arbitrum: 42161, optimism: 10, avalanche: 43114 };

interface WalletRequestBody { walletAddress: string; }

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }

  try {
    const supabaseClient = createClient( Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { return new Response(JSON.stringify({ error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    const { walletAddress }: WalletRequestBody = await req.json();
    if (!walletAddress) { return new Response(JSON.stringify({ error: 'walletAddress is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    const chainsToSync = ['eth', 'polygon', 'bsc', 'arbitrum', 'optimism', 'avalanche'];
    let allTransactions: any[] = [];

    for (const chain of chainsToSync) {
      try {
        const ankrRequestBody = { jsonrpc: '2.0', method: 'ankr_getTransactionsByAddress', params: { address: walletAddress, blockchain: [chain], limit: 1000, includeLogs: false, includePrice: true }, id: 1 };
        const response = await fetch(`https://rpc.ankr.com/multichain/${ANKR_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ankrRequestBody) });
        if (!response.ok) { console.error(`Ankr API failed for [${chain}]: ${response.statusText}`); continue; }
        const result = await response.json();
        if (result.error) { console.error(`Ankr API Error for [${chain}]: ${result.error.message}`); continue; }

        let transactions = result.result?.transactions || [];
        transactions = transactions.map(tx => {
            if (!tx.chainId && tx.blockchain && chainIdMap[tx.blockchain]) {
                return { ...tx, chainId: chainIdMap[tx.blockchain] };
            }
            return tx;
        });
        allTransactions = allTransactions.concat(transactions);
      } catch (e) { console.error(`Error processing chain [${chain}]:`, e.message); }
    }

    const validTransactions = allTransactions.filter(tx => (tx && tx.hash && tx.timestamp && tx.chainId));
    if (validTransactions.length === 0) {
        return new Response(JSON.stringify({ message: 'No valid transactions found to save.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const recordsToUpsert = await Promise.all(validTransactions.map(async (tx) => {
        const timestamp = new Date(parseInt(tx.timestamp, 16) * 1000).toISOString();
        const assetSymbol = tx.tokenSymbol || 'ETH';
        let valueUsd = null;

        if (tx.valueUsd && !isNaN(parseFloat(tx.valueUsd))) {
            valueUsd = parseFloat(tx.valueUsd);
        } else {
            const decimals = tx.tokenDecimal ? parseInt(tx.tokenDecimal, 16) : 18;
            const amount = tx.value && tx.value !== '0x0' ? Number(BigInt(tx.value)) / Math.pow(10, decimals) : 0;
            
            if (assetSymbol && timestamp && amount > 0) {
                console.log(`[Fallback] Ankr USD not found for ${amount} ${assetSymbol}. Querying current price from 'asset_prices'...`);
                // --- FIX: Corrected table and column names, and removed historical logic ---
                const { data: priceData, error: priceError } = await supabaseClient
                    .from('asset_prices')
                    .select('current_price')
                    .eq('asset', assetSymbol.toUpperCase())
                    .limit(1)
                    .single();

                if (priceError && priceError.code !== 'PGRST116') { // PGRST116: "No rows found"
                    console.error(`[Fallback] Price lookup failed for ${assetSymbol}:`, priceError.message);
                }

                if (priceData) {
                    valueUsd = priceData.current_price * amount;
                    console.log(`[Fallback] Found current price ${priceData.current_price}. Calculated approx. USD value: ${valueUsd}`);
                } else {
                    console.log(`[Fallback] No price found in asset_prices for ${assetSymbol}`);
                }
            }
        }

        const direction = tx.from && tx.from.toLowerCase() === walletAddress.toLowerCase() ? 'OUT' : 'IN';
        const chainId = typeof tx.chainId === 'string' && tx.chainId.startsWith('0x') ? parseInt(tx.chainId, 16) : Number(tx.chainId);
        let valueWei = null;
        if (tx.value && /^(0x)?[0-9a-fA-F]+$/.test(tx.value)) {
            try { valueWei = BigInt(tx.value).toString(); } catch { valueWei = null; }
        }
        
        return {
          user_id: user.id,
          wallet_address: walletAddress,
          tx_hash: tx.hash, 
          chain_id: chainId,
          direction: direction,
          timestamp: timestamp,
          from_address: tx.from,
          to_address: tx.to,
          value_wei: valueWei,
          asset_symbol: assetSymbol, 
          value_usd: valueUsd, 
          raw: tx,
        };
    }));
    
    console.log(`Attempting to upsert ${recordsToUpsert.length} valid records...`);
    const { error: upsertError } = await supabaseClient.from('wallet_transactions').upsert(recordsToUpsert, { onConflict: 'tx_hash, user_id' });
    if (upsertError) { throw new Error(`Supabase upsert error: ${upsertError.message}`); }

    return new Response(JSON.stringify({ message: `Sync successful. ${recordsToUpsert.length} valid transactions processed.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('CRITICAL ERROR in sync-wallet-transactions:', err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

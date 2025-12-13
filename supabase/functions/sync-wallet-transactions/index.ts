
// supabase/functions/sync-wallet-transactions/index.ts
// FINAL VERSION: Adds a final validation layer to filter out malformed 'ghost' transactions from Ankr.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Cors headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANKR_API_KEY = Deno.env.get('ANKR_API_KEY') ?? '';

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

    console.log(`Starting sync for wallet: ${walletAddress}`);

    for (const chain of chainsToSync) {
      console.log(`Fetching [${chain}] transactions...`);
      try {
        const ankrRequestBody = { jsonrpc: '2.0', method: 'ankr_getTransactionsByAddress', params: { address: walletAddress, blockchain: [chain], limit: 1000, includeLogs: false }, id: 1 };
        const response = await fetch(`https://rpc.ankr.com/multichain/${ANKR_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ankrRequestBody) });
        if (!response.ok) { console.error(`Ankr API failed for chain [${chain}]: ${response.statusText}`); continue; }
        const result = await response.json();
        if (result.error) { console.error(`Ankr API Error for chain [${chain}]: ${result.error.message}`); continue; }
        const transactions = result.result?.transactions || [];
        console.log(`Found ${transactions.length} transactions on [${chain}].`);
        allTransactions = allTransactions.concat(transactions);
      } catch (e) { console.error(`Error processing chain [${chain}]:`, e.message); }
    }

    console.log(`Received a total of ${allTransactions.length} transactions from Ankr.`);

    if (allTransactions.length === 0) {
        return new Response(JSON.stringify({ message: 'No new transactions found.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== FINAL DEFENSE: Filter out malformed/ghost transactions =====
    // A transaction is only valid if it has a hash, a timestamp, and a chainId.
    const validTransactions = allTransactions.filter(tx => {
        if (!tx || !tx.hash || !tx.timestamp || !tx.chainId) {
            console.warn('Skipping malformed transaction object received from Ankr:', tx);
            return false;
        }
        return true;
    });
    console.log(`Processing ${validTransactions.length} valid transactions...`);

    if (validTransactions.length === 0) {
        return new Response(JSON.stringify({ message: 'All fetched transactions were malformed. Nothing to save.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const recordsToUpsert = validTransactions.map(tx => {
      let valueWei = null;
      if (tx.value && (tx.value.startsWith('0x') || /^[0-9]+$/.test(tx.value))) {
          try { valueWei = BigInt(tx.value).toString(); } catch (e) { valueWei = null; }
      }
      const direction = tx.from && tx.from.toLowerCase() === walletAddress.toLowerCase() ? 'OUT' : 'IN';

      return {
        user_id: user.id,
        wallet_address: walletAddress,
        tx_hash: tx.hash, 
        chain_id: parseInt(tx.chainId, 16),
        direction: direction,
        timestamp: new Date(parseInt(tx.timestamp, 16) * 1000).toISOString(),
        from_address: tx.from,
        to_address: tx.to,
        value_wei: valueWei,
        asset_symbol: tx.tokenSymbol || 'ETH',
        value_usd: tx.valueUsd,
        raw: tx,
      };
    });

    const { error: upsertError } = await supabaseClient.from('wallet_transactions').upsert(recordsToUpsert, { onConflict: 'tx_hash, user_id' });

    if (upsertError) { throw new Error(`Supabase upsert error: ${upsertError.message}`); }

    return new Response(JSON.stringify({ message: `Sync successful. ${recordsToUpsert.length} valid transactions processed.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('CRITICAL ERROR in sync-wallet-transactions:', err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});



// supabase/functions/sync-wallet-transactions/index.ts
// INVESTIGATION BUILD: Added extensive logging to trace the flow of USD value.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const ANKR_API_KEY = Deno.env.get('ANKR_API_KEY') ?? '';
const chainIdMap: { [key: string]: number } = { eth: 1, polygon: 137, bsc: 56, arbitrum: 42161, optimism: 10, avalanche: 43114 };

interface WalletRequestBody { walletAddress: string; }

serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }); }
  console.log("--- sync-wallet-transactions function invoked ---");

  try {
    const supabaseClient = createClient( Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { return new Response(JSON.stringify({ error: 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    const { walletAddress }: WalletRequestBody = await req.json();
    if (!walletAddress) { return new Response(JSON.stringify({ error: 'walletAddress is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
    console.log(`Starting sync for wallet: ${walletAddress}`);

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
        
        // --- LOGGING POINT 1: Log raw Ankr response ---
        if (transactions.length > 0) {
            console.log(`[${chain}] Found ${transactions.length} transactions. Logging first raw transaction with 'valueUsd':`);
            const firstTxWithUsd = transactions.find(tx => tx.valueUsd);
            if(firstTxWithUsd) {
                console.log(JSON.stringify(firstTxWithUsd, null, 2));
            } else {
                console.log(`[${chain}] No transactions with a 'valueUsd' field found in this batch.`);
            }
        }
        // --- END LOGGING POINT 1 ---

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
        console.log("No valid transactions found across all chains. Exiting.");
        return new Response(JSON.stringify({ message: 'No valid transactions found to save.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Found a total of ${validTransactions.length} valid transactions to process.`);

    const recordsToUpsert = validTransactions.map(tx => {
      const direction = tx.from && tx.from.toLowerCase() === walletAddress.toLowerCase() ? 'OUT' : 'IN';
      const chainId = typeof tx.chainId === 'string' && tx.chainId.startsWith('0x') ? parseInt(tx.chainId, 16) : Number(tx.chainId);
      
      let valueWei = null;
      if (tx.value && /^(0x)?[0-9a-fA-F]+$/.test(tx.value)) {
          try { valueWei = BigInt(tx.value).toString(); } catch { valueWei = null; }
      }

      // --- LOGGING POINT 2: Log USD value processing ---
      let valueUsd = null;
      if (tx.valueUsd) {
          console.log(`[tx: ${tx.hash.substring(0, 10)}...] Found raw tx.valueUsd: '${tx.valueUsd}' (type: ${typeof tx.valueUsd})`);
          const parsedValue = parseFloat(tx.valueUsd);
          console.log(`[tx: ${tx.hash.substring(0, 10)}...] Parsed value: ${parsedValue}`);
          if (!isNaN(parsedValue)) {
              valueUsd = parsedValue;
          } else {
              console.log(`[tx: ${tx.hash.substring(0, 10)}...] parseFloat resulted in NaN. Setting valueUsd to null.`);
          }
      }
      // --- END LOGGING POINT 2 ---

      return {
        user_id: user.id,
        wallet_address: walletAddress,
        tx_hash: tx.hash, 
        chain_id: chainId,
        direction: direction,
        timestamp: new Date(parseInt(tx.timestamp, 16) * 1000).toISOString(),
        from_address: tx.from,
        to_address: tx.to,
        value_wei: valueWei,
        asset_symbol: tx.tokenSymbol || 'ETH', 
        value_usd: valueUsd,
        raw: tx,
      };
    });
    
    // --- LOGGING POINT 3: Log data before upsert ---
    if (recordsToUpsert.length > 0) {
        console.log("Logging first record from 'recordsToUpsert' before sending to Supabase:");
        const firstRecordWithUsd = recordsToUpsert.find(r => r.value_usd !== null);
        if (firstRecordWithUsd) {
            console.log(JSON.stringify(firstRecordWithUsd, null, 2));
        } else {
            console.log("None of the records to be upserted have a non-null 'value_usd'.");
        }
    }
    // --- END LOGGING POINT 3 ---

    console.log(`Attempting to upsert ${recordsToUpsert.length} valid records...`);
    
    // --- LOGGING POINT 4: Log upsert result ---
    const { data: upsertData, error: upsertError } = await supabaseClient.from('wallet_transactions').upsert(recordsToUpsert, { onConflict: 'tx_hash, user_id' });
    
    console.log("--- Supabase upsert operation finished ---");
    if (upsertError) {
        console.error("Supabase upsert returned an error:", upsertError);
        throw new Error(`Supabase upsert error: ${upsertError.message}`);
    } else {
        console.log("Supabase upsert completed without error. Logging returned data (if any):");
        console.log(upsertData);
    }
    // --- END LOGGING POINT 4 ---

    return new Response(JSON.stringify({ message: `Sync successful. ${recordsToUpsert.length} valid transactions processed.` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('CRITICAL ERROR in sync-wallet-transactions:', err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

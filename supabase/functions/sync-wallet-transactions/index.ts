// supabase/functions/sync-wallet-transactions/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Function initializing (v7 - Final Diagnostics)...");

const CHAIN_ID_MAP: Record<string, number> = { 'ethereum': 1, 'polygon': 137, 'arbitrum': 42161, 'base': 8453 };
const COVALENT_CHAIN_NAME_MAP: Record<string, string> = { 'ethereum': 'eth-mainnet', 'polygon': 'matic-mainnet', 'arbitrum': 'arbitrum-mainnet', 'base': 'base-mainnet' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }

  try {
    const { walletAddress, chain } = await req.json();
    console.log(`Request received for wallet ${walletAddress} on chain ${chain}`);
    if (!walletAddress || !chain) { throw new Error('walletAddress and chain are required.') }

    const numericChainId = CHAIN_ID_MAP[chain.toLowerCase()];
    if (!numericChainId) { throw new Error(`Unsupported chain or invalid chain name: ${chain}`) }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL'), SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), COVALENT_API_KEY = Deno.env.get('COVALENT_API_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !COVALENT_API_KEY) { throw new Error("Server configuration error: Missing env vars.") }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized.');
    
    const covalentChainName = COVALENT_CHAIN_NAME_MAP[chain.toLowerCase()];
    const url = `https://api.covalenthq.com/v1/${covalentChainName}/address/${walletAddress}/transactions_v2/?key=${COVALENT_API_KEY}`;
    
    console.log("Fetching from Covalent...");
    const response = await fetch(url);
    if (!response.ok) { throw new Error(`Covalent API Error: ${await response.text()}`) }
    const result = await response.json();

    // [診断ログ] Covalentからの生データの件数と、最初の1件のサンプルを出力
    console.log(`Covalent response: Found ${result.data.items.length} raw transaction items.`);
    if (result.data.items.length > 0) {
        console.log("Sample Covalent item:", JSON.stringify(result.data.items[0], null, 2));
    }
    
    const transactionsToUpsert = [];
    // ... (以前の処理ロジックは同じ)
    
    if (transactionsToUpsert.length === 0) {
      console.log("No new transactions to upsert. Informing client.");
      return new Response(JSON.stringify({ message: 'No new transactions found.', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    console.log(`Upserting ${transactionsToUpsert.length} transactions to Supabase...`);
    const { data: upsertData, error } = await supabaseAdmin.from('wallet_transactions').upsert(transactionsToUpsert, { onConflict: 'tx_hash' }).select();

    if (error) { throw error }
    
    const count = upsertData?.length ?? 0;
    console.log(`Sync successful. Upserted ${count} records.`);
    return new Response(JSON.stringify({ message: `Sync successful. ${count} transactions saved.`, count: count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error("!!!!!! Uncaught Handler Error !!!!!!", err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});

// supabase/functions/sync-wallet-transactions/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
}

console.log("Function initializing...");

Deno.serve(async (req) => {
  console.log("Request received. Method:", req.method);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("Parsing request body...");
    const { walletAddress, chain } = await req.json();
    console.log(`Payload received: walletAddress=${walletAddress}, chain=${chain}`);
    if (!walletAddress || !chain) {
      throw new Error('walletAddress and chain are required.');
    }

    // --- 1. Environment Variable Check ---
    console.log("Checking environment variables...");
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const COVALENT_API_KEY = Deno.env.get('COVALENT_API_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !COVALENT_API_KEY) {
        console.error("CRITICAL: One or more environment variables are missing!");
        throw new Error("Server configuration error: Missing environment variables.");
    }
    console.log("Environment variables are OK.");

    // --- 2. Supabase Client & Auth ---
    console.log("Initializing Supabase admin client...");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing Authorization header.");
    
    console.log("Authenticating user...");
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized: Invalid token.');
    const userId = user.id;
    console.log(`User authenticated: ${userId}`);

    // --- 3. Covalent API Call ---
    const CHAIN_MAP = { 'ethereum': 'eth-mainnet', 'polygon': 'matic-mainnet', 'arbitrum': 'arbitrum-mainnet', 'base': 'base-mainnet' };
    const covalentChainName = CHAIN_MAP[chain.toLowerCase()];
    if (!covalentChainName) throw new Error(`Unsupported chain: ${chain}`);
    
    const url = `https://api.covalenthq.com/v1/${covalentChainName}/address/${walletAddress}/transactions_v2/?key=${COVALENT_API_KEY}`;
    console.log(`Calling Covalent API: ${url.replace(COVALENT_API_KEY, 'REDACTED')}`);
    const response = await fetch(url);
    console.log(`Covalent response status: ${response.status}`);
    if (!response.ok) {
        const errText = await response.text();
        console.error("Covalent API Error Response:", errText);
        throw new Error(`Covalent API Error: Status ${response.status} - ${errText}`);
    }
    const result = await response.json();
    console.log(`Found ${result.data.items.length} transactions from Covalent.`);

    // --- 4. Data Processing & Upsert ---
    console.log("Processing transactions...");
    const transactionsToUpsert = [];
    // (Processing logic is the same as before)
    const nativeSymbol = result.data.items.length > 0 ? result.data.items[0].gas_quote_currency_symbol : 'NATIVE';
    for (const tx of result.data.items) {
      if (!tx.successful) continue;
      for (const log of tx.log_events) {
          if (log.decoded?.name === "Transfer" && log.decoded?.params) {
              const params = log.decoded.params.reduce((acc, p) => ({...acc, [p.name]: p.value}), {} as any);
              if(!params.from || !params.to || !params.value || params.value === "0") continue;
              transactionsToUpsert.push({
                  user_id: userId, tx_hash: tx.tx_hash, wallet_address: walletAddress.toLowerCase(),
                  from_address: params.from.toLowerCase(), to_address: params.to.toLowerCase(),
                  asset: log.sender_contract_ticker_symbol, amount: parseFloat(params.value) / Math.pow(10, log.sender_contract_decimals || 18),
                  ts: tx.block_signed_at, chain: chain, raw_data: { ...tx, log_event: log }
              });
          }
      }
      if (tx.value !== "0" && tx.log_events.every(log => log.decoded?.name !== "Transfer")) {
        transactionsToUpsert.push({
          user_id: userId, tx_hash: tx.tx_hash, wallet_address: walletAddress.toLowerCase(),
          from_address: tx.from_address.toLowerCase(), to_address: tx.to_address.toLowerCase(),
          asset: nativeSymbol, amount: parseFloat(tx.value) / Math.pow(10, 18),
          ts: tx.block_signed_at, chain: chain, raw_data: tx,
        });
      }
    }
    console.log(`Processed ${transactionsToUpsert.length} transactions to be upserted.`);
    
    if (transactionsToUpsert.length === 0) {
      console.log("No new transactions to save. Exiting gracefully.");
      return new Response(JSON.stringify({ message: 'No new transactions found.', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log("Upserting data to Supabase...");
    const { data: upsertData, error } = await supabaseAdmin
      .from('wallet_transactions')
      .upsert(transactionsToUpsert, { onConflict: 'user_id, tx_hash' })
      .select();

    if (error) {
        console.error("Supabase upsert error:", error);
        throw error;
    }
    
    const count = upsertData?.length ?? 0;
    console.log(`Successfully upserted ${count} records.`);
    return new Response(JSON.stringify({ message: 'Sync successful', count: count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error("!!!!!! Uncaught Handler Error !!!!!!", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});


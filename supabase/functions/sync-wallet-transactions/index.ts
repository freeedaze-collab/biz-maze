// supabase/functions/sync-wallet-transactions/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Function initializing (v5 - Full Schema Sync)...");

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { walletAddress, chain } = await req.json();
    if (!walletAddress || !chain) {
      throw new Error('walletAddress and chain are required.');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const COVALENT_API_KEY = Deno.env.get('COVALENT_API_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !COVALENT_API_KEY) {
        throw new Error("Server configuration error: Missing environment variables.");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing Authorization header.");
    
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized: Invalid token.');
    const userId = user.id;

    const CHAIN_MAP: Record<string, string> = { 'ethereum': 'eth-mainnet', 'polygon': 'matic-mainnet', 'arbitrum': 'arbitrum-mainnet', 'base': 'base-mainnet' };
    const covalentChainName = CHAIN_MAP[chain.toLowerCase()];
    if (!covalentChainName) throw new Error(`Unsupported chain: ${chain}`);
    
    const url = `https://api.covalenthq.com/v1/${covalentChainName}/address/${walletAddress}/transactions_v2/?key=${COVALENT_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Covalent API Error: Status ${response.status} - ${errText}`);
    }
    const result = await response.json();
    
    const transactionsToUpsert = [];
    const nativeSymbol = result.data.items.length > 0 ? result.data.items[0].gas_quote_currency_symbol : 'NATIVE';
    const userWallet = walletAddress.toLowerCase();

    for (const tx of result.data.items) {
      if (!tx.successful) continue;
      
      const getDirection = (from, to) => {
        if (from === userWallet && to !== userWallet) return 'out';
        if (from !== userWallet && to === userWallet) return 'in';
        return 'self';
      };

      for (const log of tx.log_events) {
          if (log.decoded?.name === "Transfer" && log.decoded?.params) {
              const params = log.decoded.params.reduce((acc, p) => ({...acc, [p.name]: p.value}), {} as any);
              if(!params.from || !params.to || !params.value || params.value === "0") continue;
              transactionsToUpsert.push({
                  user_id: userId,
                  wallet_address: userWallet,
                  chain_id: chain,
                  direction: getDirection(params.from.toLowerCase(), params.to.toLowerCase()),
                  tx_hash: tx.tx_hash,
                  block_number: tx.block_height,
                  timestamp: tx.block_signed_at,
                  from_address: params.from.toLowerCase(),
                  to_address: params.to.toLowerCase(),
                  value_wei: parseFloat(params.value) / Math.pow(10, log.sender_contract_decimals || 18),
                  asset_symbol: log.sender_contract_ticker_symbol,
                  raw: { ...tx, log_event: log }
              });
          }
      }
      if (tx.value !== "0" && tx.log_events.every(log => log.decoded?.name !== "Transfer")) {
        transactionsToUpsert.push({
          user_id: userId,
          wallet_address: userWallet,
          chain_id: chain,
          direction: getDirection(tx.from_address.toLowerCase(), tx.to_address.toLowerCase()),
          tx_hash: tx.tx_hash,
          block_number: tx.block_height,
          timestamp: tx.block_signed_at,
          from_address: tx.from_address.toLowerCase(),
          to_address: tx.to_address.toLowerCase(),
          value_wei: parseFloat(tx.value) / Math.pow(10, 18),
          asset_symbol: nativeSymbol,
          raw: tx,
        });
      }
    }
    
    if (transactionsToUpsert.length === 0) {
      return new Response(JSON.stringify({ message: 'No new transactions found.', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: upsertData, error } = await supabaseAdmin
      .from('wallet_transactions')
      .upsert(transactionsToUpsert, { onConflict: 'tx_hash' }) // The unique constraint is on tx_hash only
      .select();

    if (error) {
        console.error("Supabase upsert error:", error);
        throw error;
    }
    
    const count = upsertData?.length ?? 0;
    return new Response(JSON.stringify({ message: 'Sync successful', count: count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error("!!!!!! Uncaught Handler Error !!!!!!", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// supabase/functions/sync-wallet-transactions/index.ts
// ... (他の部分は変更なし、upsert部分のみ修正)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const CHAIN_ID_MAP: Record<string, number> = { 'ethereum': 1, 'polygon': 137, 'arbitrum': 42161, 'base': 8453 };
const COVALENT_CHAIN_NAME_MAP: Record<string, string> = { 'ethereum': 'eth-mainnet', 'polygon': 'matic-mainnet', 'arbitrum': 'arbitrum-mainnet', 'base': 'base-mainnet' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }
  try {
    const { walletAddress, chain } = await req.json();
    const numericChainId = CHAIN_ID_MAP[chain.toLowerCase()];
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized.');
    
    const covalentChainName = COVALENT_CHAIN_NAME_MAP[chain.toLowerCase()];
    const url = `https://api.covalenthq.com/v1/${covalentChainName}/address/${walletAddress}/transactions_v2/?key=${Deno.env.get('COVALENT_API_KEY')!}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Covalent API Error: ${await response.text()}`);
    const result = await response.json();
    
    const transactionsToUpsert = [];
    // ... (処理ロジックは前回と同じ)
    for (const tx of result.data.items) { /* ... */ }

    if (transactionsToUpsert.length === 0) {
      return new Response(JSON.stringify({ message: 'No new transactions found.', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: upsertData, error } = await supabaseAdmin
      // [最重要修正] 正しいテーブル名 `transactions` に書き込む
      .from('transactions')
      .upsert(transactionsToUpsert, { onConflict: 'tx_hash' })
      .select();

    if (error) throw error;
    
    return new Response(JSON.stringify({ message: 'Sync successful.', count: upsertData?.length ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error("!!!!!! Wallet Sync Error !!!!!!", err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});

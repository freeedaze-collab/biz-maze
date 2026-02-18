
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient as createSupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http, formatEther } from 'https://esm.sh/viem@2.7.1';
import { mainnet, bsc, polygon } from 'https://esm.sh/viem@2.7.1/chains';

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// チェーン設定
const ALCHEMY_KEY = Deno.env.get('VITE_ALCHEMY_API_KEY');
const chains = {
  'ethereum': {
    viemChain: mainnet,
    transport: http(ALCHEMY_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : undefined)
  },
  'bsc': {
    viemChain: bsc,
    transport: http(ALCHEMY_KEY ? `https://bsc-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : undefined)
  },
  'polygon': {
    viemChain: polygon,
    transport: http(ALCHEMY_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : undefined)
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { walletId } = await req.json();
    if (!walletId) {
      throw new Error("walletId is required");
    }

    // Supabaseクライアントの初期化
    const supabase = createSupabaseClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ウォレット接続情報を取得
    const { data: wallet, error: walletError } = await supabase
      .from('wallet_connections')
      .select('id, wallet_address, network') // 'network'カラムを想定
      .eq('id', walletId)
      .single();

    if (walletError) throw walletError;
    if (!wallet) throw new Error('Wallet not found');
    if (!wallet.wallet_address) throw new Error("Wallet address is missing.");
    if (!wallet.network) throw new Error("Wallet network is not specified.");

    // 対応チェーンかどうかを確認
    const chainConfig = chains[wallet.network];
    if (!chainConfig) {
      throw new Error(`Unsupported network: ${wallet.network}`);
    }

    // Viemパブリッククライアントを作成
    const client = createPublicClient({
      chain: chainConfig.viemChain,
      transport: chainConfig.transport,
    });

    // ブロックチェーンからネイティブ残高を取得
    const balanceWei = await client.getBalance({
      address: wallet.wallet_address as `0x${string}`,
    });

    // WeiからEther単位に変換
    const balanceEther = formatEther(balanceWei);

    console.log(`Synced balance for wallet ${wallet.id}: ${balanceEther} ${chainConfig.viemChain.nativeCurrency.symbol}`);

    // DBの残高を更新 (balance_usdをネイティブ残高で更新, カラム名は要検討)
    const { error: updateError } = await supabase
      .from('wallet_connections')
      .update({
        balance_native: parseFloat(balanceEther), // 新しいカラム 'balance_native' を想定
        last_sync_at: new Date().toISOString()
      })
      .eq('id', wallet.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, balance: balanceEther }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in sync-wallet-balance:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

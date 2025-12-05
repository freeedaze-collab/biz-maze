import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import ccxt from 'https://esm.sh/ccxt@4.3.40';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// エッジ関数のエントリポイント
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Received payload:', payload);

    const { exchange, encrypted_blob, markets } = payload;
    if (!exchange || !encrypted_blob || !Array.isArray(markets)) {
      console.error('Missing exchange / encrypted_blob / markets in request payload');
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Supabaseクライアント初期化（管理者権限）
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase environment variables (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY) are not set');
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ユーザー取得
    const { data: connRecord, error: connError } = await supabase
      .from('exchange_connections')
      .select('user_id')
      .eq('exchange', exchange)
      .eq('encrypted_blob', encrypted_blob)
      .maybeSingle();
    if (connError) {
      console.error('Error querying exchange_connections:', connError);
      throw connError;
    }
    const userId = connRecord?.user_id;
    if (!userId) {
      console.error('User not found for exchange', exchange, 'with provided credentials blob');
      throw new Error('User not found');
    }

    // 接続情報の復号（別の Edge Function をコール）
    const { data: creds, error: decryptError } = await supabase.functions.invoke('decrypt-connection', {
      body: { encrypted_blob }
    });
    if (decryptError) {
      console.error('Failed to decrypt credentials:', decryptError);
      throw new Error(decryptError.message ?? 'Failed to decrypt credentials');
    }
    const { apiKey, secret, password } = creds!;
    console.log('Decrypted API credentials for', exchange, {
      apiKey: apiKey ? '***' : undefined,
      secret: secret ? '***' : undefined,
      password: password ? '***' : undefined
    });

    // CCXTクライアント初期化
    const CcxtClass = (ccxt as any)[exchange];
    if (!CcxtClass) {
      throw new Error(`Exchange "${exchange}" not supported by CCXT`);
    }
    const client = new CcxtClass({ apiKey, secret, password });

    let totalSaved = 0;

    // 各マーケットごとに取引データ取得と保存
    for (const market of markets) {
      const trades = await client.fetchMyTrades(market);
      if (!Array.isArray(trades)) {
        console.warn(`Unexpected fetchMyTrades result for ${market}:`, trades);
        continue;
      }
      console.log(`Fetched ${trades.length} trades for ${market}`);

      if (trades.length === 0) {
        continue;
      }

      // 既存のトレードIDを取得し、重複を除外
      const tradeIds = trades.map((t: any) => t.id);
      const { data: existingTrades, error: fetchError } = await supabase
        .from('exchange_trades')
        .select('trade_id')
        .in('trade_id', tradeIds);
      if (fetchError) {
        console.error('Error checking existing trades for', market, ':', fetchError);
        throw fetchError;
      }
      const existingIds = new Set((existingTrades ?? []).map((t: any) => t.trade_id));

      // 新規トレードのみ抽出
      const newTrades = trades.filter((t: any) => !existingIds.has(t.id)).map((t: any) => ({
        user_id: userId,
        exchange,
        symbol: t.symbol,
        side: t.side,
        amount: t.amount,
        price: t.price,
        fee: t.fee?.cost ?? null,
        fee_currency: t.fee?.currency ?? null,
        fee_asset: t.fee?.currency ?? null,
        external_id: t.id,
        trade_id: t.id,
        raw_data: t,
        ts: t.timestamp ? new Date(t.timestamp).toISOString() : new Date().toISOString()
      }));
      console.log(`Inserting ${newTrades.length} new trades for ${market}`);

      // 新規トレードをテーブルに挿入
      if (newTrades.length > 0) {
        const { error: insertError } = await supabase.from('exchange_trades').insert(newTrades);
        if (insertError) {
          console.error('Insert error for', market, ':', insertError);
          throw insertError;
        }
        totalSaved += newTrades.length;
      }
    }

    console.log(`✅ Saved ${totalSaved} new trades for user ${userId}`);
    return new Response(JSON.stringify({ message: 'Sync completed', totalSaved }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[WORKER ERROR]', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// supabase/functions/exchange-sync-all/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ccxt } from 'https://esm.sh/ccxt@4.3.40' // 正しいインポート方法
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// [重要] お客様のコードに倣い、ccxtライブラリの標準形式でシンボルを定義
const BINANCE_SYMBOLS = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT"];

// --- 復号ロジック (変更なし) ---
async function getKey() { /* ... */ }
async function decryptBlob(blob: string): Promise<{ apiKey: string; apiSecret: string; apiPassphrase?: string }> { /* ... */ }


// --- メインのサーバー処理 ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization')!.replace('Bearer ', ''));
    if (!user) throw new Error('User not found.');

    const { data: connections, error: connError } = await supabaseAdmin
      .from('exchange_connections')
      .select('id, exchange, encrypted_blob')
      .eq('user_id', user.id);

    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ message: "No exchange connections found.", totalSaved: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allTradesToUpsert = [];

    for (const conn of connections) {
      if (!conn.encrypted_blob) continue;
      
      const credentials = await decryptBlob(conn.encrypted_blob);
      const exchangeInstance = new ccxt[conn.exchange]({
        apiKey: credentials.apiKey,
        secret: credentials.apiSecret,
        password: credentials.apiPassphrase,
      });

      let trades = [];

      // [最重要修正] お客様のコードに倣い、取引所ごとの処理を分岐
      if (conn.exchange === 'binance') {
        // Binanceの場合、定義済みのシンボルを一つずつ巡回して取得
        for (const symbol of BINANCE_SYMBOLS) {
          try {
            const symbolTrades = await exchangeInstance.fetchMyTrades(symbol);
            if (symbolTrades.length > 0) {
              trades.push(...symbolTrades);
            }
          } catch (e) {
            // 特定のシンボルで取引履歴がなくてもエラーにせず、処理を続行
            console.warn(`Could not fetch trades for ${symbol} on Binance. Error: ${e.message}`);
          }
        }
      } else {
        // Binance以外の取引所 (Bybit, OKXなど) は、一度に全履歴を取得
        trades = await exchangeInstance.fetchMyTrades();
      }

      if (trades.length > 0) {
        const tradesToUpsert = trades.map(trade => ({
            user_id: user.id,
            exchange: conn.exchange,
            raw_data: trade
        }));
        allTradesToUpsert.push(...tradesToUpsert);
      }
    }
    
    let totalSavedCount = 0;
    if (allTradesToUpsert.length > 0) {
      const { data, error } = await supabaseAdmin.from('exchange_trades').upsert(allTradesToUpsert, { onConflict: "user_id,exchange,(raw_data->>'id')" }).select();
      if (error) throw error;
      totalSavedCount = data?.length ?? 0;
    }

    return new Response(JSON.stringify({ message: `Sync complete.`, totalSaved: totalSavedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error(`!!!!!! Exchange Sync All Error !!!!!!`, err);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});

// supabase/functions/sync-historical-exchange-rates/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return null;
}

function jsonHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...corsHeaders, "Content-Type": "application/json", ...extra };
}

const toISODateString = (date: Date) => date.toISOString().split('T')[0];

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const fiatCurrencies = ['jpy', 'eur', 'inr', 'sgd'];
    const cryptoAssets = [
      { symbol: 'GTC', id: 'gitcoin' },
      { symbol: 'USDC', id: 'usd-coin' },
      { symbol: 'DAI', id: 'dai' },
      { symbol: 'ETH', id: 'ethereum' },
      { symbol: 'BTC', id: 'bitcoin' }
    ];

    const days = 730; // Extended to 2 years to match transaction sync
    const allRatesToUpsert: any[] = [];

    // Sync Fiat Rates
    const tetherId = 'tether';
    for (const vsCurrency of fiatCurrencies) {
      console.log(`Fetching fiat rates for ${vsCurrency.toUpperCase()}...`);
      const url = `https://api.coingecko.com/api/v3/coins/${tetherId}/market_chart?vs_currency=${vsCurrency}&days=${days}&interval=daily`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const seenDates = new Set();
      const rates = (data.prices || []).map(([ts, price]: [number, number]) => {
        const dateStr = toISODateString(new Date(ts));
        if (!price || seenDates.has(dateStr)) return null;
        seenDates.add(dateStr);
        return {
          date: dateStr,
          source_currency: vsCurrency.toUpperCase(),
          target_currency: 'USD',
          rate: 1 / price
        };
      }).filter(Boolean);
      allRatesToUpsert.push(...rates);
    }

    // Sync Crypto Rates
    for (const asset of cryptoAssets) {
      console.log(`Fetching crypto rates for ${asset.symbol}...`);
      const url = `https://api.coingecko.com/api/v3/coins/${asset.id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const seenDates = new Set();
      const rates = (data.prices || []).map(([ts, price]: [number, number]) => {
        const dateStr = toISODateString(new Date(ts));
        if (!price || seenDates.has(dateStr)) return null;
        seenDates.add(dateStr);
        return {
          date: dateStr,
          source_currency: asset.symbol,
          target_currency: 'USD',
          rate: price
        };
      }).filter(Boolean);
      allRatesToUpsert.push(...rates);
    }

    if (allRatesToUpsert.length === 0) {
      throw new Error('No rates could be fetched');
    }

    // Chunk size 100 to avoid large batch issues
    const chunkSize = 100;
    for (let i = 0; i < allRatesToUpsert.length; i += chunkSize) {
      const chunk = allRatesToUpsert.slice(i, i + chunkSize);
      const { error } = await supabase.from('daily_exchange_rates').upsert(chunk, { onConflict: 'date,source_currency,target_currency' });
      if (error) {
        console.error(`Error upserting chunk: ${error.message}`);
        // If just one chunk fails due to a conflict, we might want to continue or throw
      }
    }

    return new Response(JSON.stringify({ success: true, count: allRatesToUpsert.length }), {
      headers: jsonHeaders(),
      status: 200,
    });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: jsonHeaders(),
      status: 500,
    });
  }
});

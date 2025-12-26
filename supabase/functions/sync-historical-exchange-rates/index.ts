
// supabase/functions/sync-historical-exchange-rates/index.ts
// PURPOSE: A new edge function to fetch and store historical daily exchange rates for multiple currencies against USD for the last 90 days.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- EMBEDDED CORS & JSON HELPERS ---
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

function jsonHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...corsHeaders, "Content-Type": "application/json", ...extra };
}
// --- END of embedded helpers ---

console.log("`sync-historical-exchange-rates` function invoked.");

// Helper to format a date as YYYY-MM-DD
const toISODateString = (date: Date) => {
    return date.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) {
    return optionsResponse;
  }

  try {
    console.log("Creating Supabase service role client.");
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Define the list of currencies to sync against USD.
    const currenciesToSync = ['jpy', 'eur', 'inr', 'sgd'];
    const coingeckoId = 'tether'; // Using Tether (USDT) as a proxy for USD.
    const days = 90;
    let allRatesToUpsert = [];

    console.log(`Starting to fetch historical rates for: ${currenciesToSync.join(', ')}`);

    for (const vsCurrency of currenciesToSync) {
        console.log(`Fetching rates for ${vsCurrency.toUpperCase()}...`);
        const priceUrl = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=${vsCurrency}&days=${days}&interval=daily`;

        console.log(`Fetching historical rates from: ${priceUrl}`);
        const priceResponse = await fetch(priceUrl);

        if (!priceResponse.ok) {
          const errorBody = await priceResponse.text();
          console.error(`CoinGecko API error for ${vsCurrency}:`, errorBody);
          // Continue to the next currency instead of failing the whole process
          continue; 
        }

        const priceData = await priceResponse.json();
        const dailyPrices = priceData.prices;

        if (!dailyPrices || dailyPrices.length === 0) {
            console.warn(`No historical price data returned from CoinGecko for ${vsCurrency}.`);
            continue;
        }

        // The rate stored should be the multiplier to convert SOURCE -> USD.
        // If 1 USD = 150 JPY, then 1 JPY = 1/150 USD. The rate is 1/price.
        const ratesToUpsert = dailyPrices.map(([timestamp, price]) => {
          if(price === 0 || price === null) return null; // Avoid division by zero or invalid data

          const date = new Date(timestamp);
          
          return {
            date: toISODateString(date), // Format as YYYY-MM-DD
            source_currency: vsCurrency.toUpperCase(),
            target_currency: 'USD',
            rate: 1 / price, // This is the multiplier to convert SOURCE to USD
          };
        }).filter(Boolean); // Filter out any null entries

        if (ratesToUpsert.length > 0) {
            allRatesToUpsert.push(...ratesToUpsert);
            console.log(`Successfully processed ${ratesToUpsert.length} rates for ${vsCurrency.toUpperCase()}.`);
        } else {
            console.warn(`Could not process any rates for ${vsCurrency.toUpperCase()} from the API response.`);
        }
    }

    if (allRatesToUpsert.length === 0) {
      throw new Error('Could not process any rates from the API for any currency.');
    }

    // 3. Upsert all collected rates into the database in a single batch.
    console.log(`Upserting ${allRatesToUpsert.length} total historical rates into daily_exchange_rates...`);
    const { error: upsertError } = await supabase
      .from('daily_exchange_rates')
      .upsert(allRatesToUpsert);

    if (upsertError) {
      console.error("Error upserting exchange rates:", upsertError);
      throw upsertError;
    }

    console.log("Historical exchange rate sync completed successfully.");
    return new Response(JSON.stringify({ success: true, synced_rates: allRatesToUpsert.length }), {
      headers: jsonHeaders(),
      status: 200,
    });

  } catch (e) {
    console.error("An unexpected error occurred:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: jsonHeaders(),
      status: 500,
    });
  }
});

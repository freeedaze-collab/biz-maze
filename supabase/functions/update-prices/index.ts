// supabase/functions/update-prices/index.ts
// PURPOSE: An edge function to fetch real-time crypto prices and update the database.
// FINAL VERSION: All CORS logic is embedded to remove external dependencies and fix deployment.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- EMBEDDED CORS & JSON HELPERS ---
// This logic is self-contained to ensure it works without any shared module imports.
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

console.log("`update-prices` function invoked.");

Deno.serve(async (req) => {
  // Use the self-contained OPTIONS handler.
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

    // 1. Get all unique asset symbols from the transactions table.
    console.log("Fetching unique asset symbols from all_transactions...");
    const { data: assets, error: assetsError } = await supabase
      .from('all_transactions')
      .select('asset');

    if (assetsError) {
      console.error("Error fetching assets:", assetsError);
      throw assetsError;
    }

    const uniqueSymbols = [...new Set(assets.map(a => a.asset).filter(a => a))];
    console.log("Found unique symbols:", uniqueSymbols);

    if (uniqueSymbols.length === 0) {
      return new Response(JSON.stringify({ message: 'No assets found to update.' }), {
        headers: jsonHeaders(),
        status: 200,
      });
    }

    // 2. Map internal symbols to CoinGecko API IDs.
    const assetIdMap = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
    };

    const coingeckoIds = uniqueSymbols.map(symbol => assetIdMap[symbol]).filter(id => id);
    console.log("Mapped to CoinGecko IDs:", coingeckoIds);
    
    if (coingeckoIds.length === 0) {
        return new Response(JSON.stringify({ message: 'No supported assets for price lookup.' }), {
            headers: jsonHeaders(),
            status: 200,
        });
    }

    // 3. Fetch prices from CoinGecko.
    const priceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds.join(',')}&vs_currencies=usd`;
    console.log(`Fetching prices from: ${priceUrl}`);
    const priceResponse = await fetch(priceUrl);

    if (!priceResponse.ok) {
      const errorBody = await priceResponse.text();
      console.error("CoinGecko API error:", errorBody);
      throw new Error(`Failed to fetch prices from CoinGecko: ${errorBody}`);
    }

    const priceData = await priceResponse.json();
    console.log("Received price data:", priceData);

    // 4. Prepare data for upsert.
    const idToAssetMap = Object.fromEntries(Object.entries(assetIdMap).map(([asset, id]) => [id, asset]));
    
    const pricesToUpsert = Object.entries(priceData).map(([id, priceInfo]) => ({
      asset: idToAssetMap[id],
      current_price: priceInfo.usd,
    }));

    if (pricesToUpsert.length === 0) {
       throw new Error('No prices were resolved from the API response to upsert.');
    }
    
    // 5. Upsert prices into the database.
    console.log("Upserting prices into asset_prices table:", pricesToUpsert);
    const { error: upsertError } = await supabase
      .from('asset_prices')
      .upsert(pricesToUpsert, { onConflict: 'asset' });

    if (upsertError) {
      console.error("Error upserting prices:", upsertError);
      throw upsertError;
    }

    console.log("Price update process completed successfully.");
    return new Response(JSON.stringify({ success: true, updated_assets: pricesToUpsert.map(p => p.asset) }), {
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

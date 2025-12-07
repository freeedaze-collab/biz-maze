
// supabase/functions/portfolio-summary/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import ccxt from 'https://esm.sh/ccxt@4.3.40'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

// For simplicity, we use one major exchange for all ticker prices.
const exchange = new ccxt.binance();

// --- [START] NEW, ROBUST PRICE FETCHER ---
// This function is designed to find the USD price for any given crypto asset.
// It uses a series of fallbacks to ensure the highest chance of success.
async function getUsdPrice(asset: string) {
    if (asset === 'USD' || asset === 'USDT') {
        return { price: 1, currency: 'USD' };
    }

    // 1. Primary Method: Try to get the price against USDT (which we treat as USD)
    try {
        const ticker = await exchange.fetchTicker(`${asset}/USDT`);
        if (ticker?.last) {
            return { price: ticker.last, currency: 'USD' };
        }
    } catch (e) {
        // Market doesn't exist, proceed to fallback.
    }

    // 2. Fallback Method: Try to get the price against BTC, then convert BTC to USD.
    try {
        // Find asset price in BTC
        const assetBtcTicker = await exchange.fetchTicker(`${asset}/BTC`);
        if (assetBtcTicker?.last) {
            // Find BTC price in USD (via USDT)
            const btcUsdTicker = await exchange.fetchTicker('BTC/USDT');
            if (btcUsdTicker?.last) {
                // Calculate and return the final USD price
                const usdPrice = assetBtcTicker.last * btcUsdTicker.last;
                return { price: usdPrice, currency: 'USD' };
            }
        }
    } catch (e) {
        // Market pair doesn't exist, or BTC/USDT failed.
    }
    
    // If all methods fail, return null.
    return null;
}
// --- [END] NEW, ROBUST PRICE FETCHER ---


Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Create a Supabase client with the user's authorization.
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // Get the user from the session.
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        // Fetch the calculated holdings from our definitive view.
        const { data: holdings, error: holdingsError } = await supabase.from('v_holdings').select('*');

        if (holdingsError) {
            throw new Error(`Failed to fetch holdings: ${holdingsError.message}`);
        }

        if (!holdings || holdings.length === 0) {
            return new Response(JSON.stringify([]), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // --- [START] MODIFIED PORTFOLIO CALCULATION ---
        // For each holding, fetch the current market price IN USD and calculate P&L.
        const portfolio = await Promise.all(holdings.map(async (holding) => {
            const priceInfo = await getUsdPrice(holding.asset);

            const current_price = priceInfo?.price ?? null;
            // The currency is now always USD if a price is found.
            const current_price_currency = priceInfo?.currency ?? null; 
            
            const current_value = current_price ? current_price * holding.current_amount : null;
            
            // IMPORTANT: The \`total_cost\` from \`v_holdings\` is already in USD-equivalent terms
            // because it was calculated from \`price * amount\` where price was likely from a USD(T) pair.
            const unrealized_pnl = current_value && holding.total_cost > 0 ? current_value - holding.total_cost : null;
            const unrealized_pnl_percent = (unrealized_pnl && holding.total_cost > 0) ? (unrealized_pnl / holding.total_cost) * 100 : null;

            return {
                ...holding,
                current_price,
                current_price_currency, // This will be 'USD' or null
                current_value,
                unrealized_pnl,
                unrealized_pnl_percent,
            };
        }));
        // --- [END] MODIFIED PORTFOLIO CALCULATION ---

        return new Response(JSON.stringify(portfolio), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});

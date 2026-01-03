import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COINGECKO_IDS: Record<string, string> = {
    BTC: "bitcoin",
    ETH: "ethereum",
    USDC: "usd-coin",
    JPYC: "jpy-coin", // Note: JPYC symbol might vary on CG, but let's assume this for now or fallback
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { invoiceId, payAsset, payNetwork } = await req.json().catch(() => ({}));

        if (!invoiceId || !payAsset || !payNetwork) {
            return new Response(JSON.stringify({ error: "Missing required fields: invoiceId, payAsset, payNetwork" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 1) Fetch Invoice
        const { data: invoice, error: invErr } = await supabase
            .from("invoices")
            .select("*")
            .eq("id", invoiceId)
            .single();

        if (invErr || !invoice) {
            return new Response(JSON.stringify({ error: "Invoice not found" }), {
                status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 2) Get Merchant's Vault Address
        const { data: vault } = await supabase
            .from("payment_vault_addresses")
            .select("address")
            .eq("user_id", invoice.user_id)
            .eq("network", payNetwork)
            .eq("asset", payAsset)
            .maybeSingle();

        // Fallback or mock address if vault not configured (for demo/dev)
        const depositAddress = vault?.address || "0x" + Math.random().toString(16).slice(2, 42);

        // 3) Fetch Real-time Rates
        const cgId = COINGECKO_IDS[payAsset.toUpperCase()] || "usd-coin";
        const vsCurrency = (invoice.currency || "USD").toLowerCase();

        console.log(`[Intent] Fetching rate for asset: ${cgId}, vs: ${vsCurrency}`);

        let rate = 1;
        try {
            const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=${vsCurrency}`);
            if (resp.ok) {
                const data = await resp.json();
                rate = data[cgId][vsCurrency] || 1;
                console.log(`[Intent] Fetched rate: ${rate}`);
            } else {
                console.warn(`[Intent] Rate fetch failed with status: ${resp.status}`);
            }
        } catch (e) {
            console.warn("[Intent] Failed to fetch rate, using 1:1 fallback", e);
        }

        const amountCrypto = rate > 0 ? invoice.total / rate : 0;
        console.log(`[Intent] Total: ${invoice.total}, Calculated Crypto: ${amountCrypto}`);

        // 4) Create Intent
        const { data: intent, error: insErr } = await supabase
            .from("payment_intents")
            .insert({
                invoice_id: invoiceId,
                user_id: invoice.user_id,
                status: "pending",
                requested_amount: invoice.total,
                requested_currency: invoice.currency,
                pay_asset: payAsset,
                pay_network: payNetwork,
                pay_address: depositAddress,
                expires_at: new Date(Date.now() + 20 * 60000).toISOString(),
            })
            .select()
            .single();

        if (insErr) throw insErr;

        return new Response(
            JSON.stringify({
                ok: true,
                intent: intent,
                rate: rate,
                amount_crypto: amountCrypto
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (e: any) {
        console.error(e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});

// supabase/functions/create-checkout/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/itty-router-cors@0.4.3";

type GeckResp = Record<string, Record<string, number>>;

const COINGECKO_IDS: Record<string, string> = {
  USDC: "usd-coin",
  USDT: "tether",
  ETH: "ethereum",
  MATIC: "matic-network",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const linkId = Number(body.link_id);
    const payAsset = String(body.pay_asset ?? "USDC").toUpperCase();
    const payNetwork = String(body.pay_network ?? "Polygon");

    if (!linkId) {
      return new Response(JSON.stringify({ error: "link_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1) link 取得
    const { data: link, error: linkErr } = await supabase
      .from("payment_links")
      .select("*")
      .eq("id", linkId)
      .single();

    if (linkErr || !link) {
      return new Response(JSON.stringify({ error: "link not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2) 受取先アドレス（Vault）取得（MVP）
    const { data: vault } = await supabase
      .from("payment_vault_addresses")
      .select("*")
      .eq("user_id", link.user_id)
      .eq("network", payNetwork)
      .eq("asset", payAsset)
      .maybeSingle();

    if (!vault?.address) {
      return new Response(JSON.stringify({ error: "No vault address for network/asset" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3) 法定→暗号資産の換算（CoinGecko）
    const coingeckoId = COINGECKO_IDS[payAsset];
    if (!coingeckoId) {
      return new Response(JSON.stringify({ error: "Unsupported asset" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const vs = String(link.currency ?? "USD").toLowerCase();
    const geckUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=${vs}`;
    const geckRes = await fetch(geckUrl);
    if (!geckRes.ok) {
      return new Response(JSON.stringify({ error: "Rate fetch failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const rates = (await geckRes.json()) as GeckResp;
    const price = rates?.[coingeckoId]?.[vs];
    if (!price || !Number.isFinite(price)) {
      return new Response(JSON.stringify({ error: "Invalid rate" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // required crypto = fiat / price
    const requiredCrypto = Number(link.amount) / Number(price);

    // 4) intent 作成（MVP: 固定受取先アドレス）
    const { data: intent, error: insErr } = await supabase
      .from("payment_intents")
      .insert({
        user_id: link.user_id,
        link_id: link.id,
        status: "requires_payment",
        requested_amount: link.amount,
        requested_currency: link.currency,
        pay_asset: payAsset,
        pay_network: payNetwork,
        pay_address: vault.address, // ← 将来は per-intent 生成に差替え
      })
      .select()
      .single();

    if (insErr) {
      console.error(insErr);
      return new Response("Insert failed", { status: 500, headers: corsHeaders });
    }

    const hostedUrl = `${new URL(req.url).origin}/checkout/${intent.id}`;

    return new Response(
      JSON.stringify({
        intent_id: intent.id,
        hosted_url: hostedUrl,
        price_fiat: price,
        required_crypto: requiredCrypto,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response("Internal Error", { status: 500, headers: corsHeaders });
  }
});

// index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";
import * as ccxt from "npm:ccxt";

console.log("booted worker");

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("Received payload:", payload);

    const { exchange, encrypted_blob, markets } = payload;
    if (!exchange || !encrypted_blob || !Array.isArray(markets)) {
      console.error("Missing exchange / encrypted_blob / markets");
      return new Response("Missing params", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ユーザー取得
    const userRes = await supabase
      .from("exchange_connections")
      .select("user_id")
      .eq("exchange", exchange)
      .eq("encrypted_blob", encrypted_blob)
      .maybeSingle();

    const userId = userRes.data?.user_id;
    if (!userId) {
      console.error("User not found. Given exchange:", exchange, "blob:", encrypted_blob);
      throw new Error("User not found");
    }

    // blob 復号
    const blobRes = await supabase.functions.invoke("decrypt-connection", {
      body: { encrypted_blob },
    });
    if (blobRes.error) {
      console.error("Failed to decrypt blob", blobRes.error);
      throw blobRes.error;
    }

    const { apiKey, secret, password } = blobRes.data;
    console.log("Decrypted keys:", { apiKey, secret, password: password ? "***" : undefined });

    const client = new (ccxt as any)[exchange]({
      apiKey,
      secret,
      password,
    });

    let totalSaved = 0;

    for (const market of markets) {
      const trades = await client.fetchMyTrades(market);
      console.log(`Fetched ${trades.length} trades for ${market}`);

      if (!Array.isArray(trades)) continue;

      const tradeIds = trades.map((t: any) => t.id);
      const { data: existing } = await supabase
        .from("exchange_trades")
        .select("trade_id")
        .in("trade_id", tradeIds);

      const existingIds = new Set((existing || []).map((t: any) => t.trade_id));
      const newTrades = trades
        .filter((t: any) => !existingIds.has(t.id))
        .map((t: any) => ({
          user_id: userId,
          exchange,
          symbol: t.symbol,
          side: t.side,
          amount: t.amount,
          price: t.price,
          fee: t.fee?.cost,
          fee_currency: t.fee?.currency,
          fee_asset: t.fee?.currency,
          external_id: t.id,
          trade_id: t.id,
          raw_data: t,
          ts: t.timestamp ? new Date(t.timestamp).toISOString() : new Date().toISOString(),
        }));

      console.log(`Inserting ${newTrades.length} new trades for ${market}`);

      if (newTrades.length > 0) {
        const { error } = await supabase.from("exchange_trades").insert(newTrades);
        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
        totalSaved += newTrades.length;
      }
    }

    console.log(`✅ Saved ${totalSaved} new trades for user ${userId}`);
    return new Response(JSON.stringify({ saved: totalSaved }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[WORKER ERROR]", err);
    return new Response("Internal Error", { status: 500 });
  }
});

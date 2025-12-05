import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import ccxt from "npm:ccxt";
import dayjs from "https://esm.sh/dayjs";
import { decrypt } from "../../utils/kms.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTION_ENDPOINT = Deno.env.get("SUPABASE_FUNCTION_ENDPOINT")!;

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401 });

    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader);
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { data: accounts } = await supabase
      .from("exchange_accounts")
      .select("*")
      .eq("user_id", user.id);

    if (!accounts || accounts.length === 0)
      return new Response("No accounts found", { status: 404 });

    let totalSaved = 0;

    for (const acc of accounts) {
      if (!acc.api_key_encrypted || !acc.api_secret_encrypted)
        continue;

      const apiKey = await decrypt(acc.api_key_encrypted);
      const apiSecret = await decrypt(acc.api_secret_encrypted);
      const ccxtClass = (ccxt as any)[acc.exchange];
      if (!ccxtClass) continue;

      const exchange = new ccxtClass({
        apiKey,
        secret: apiSecret,
        enableRateLimit: true,
      });

      await exchange.loadMarkets();

      const balances = await exchange.fetchBalance();
      const currencies = new Set(Object.keys(balances.total).filter((c) => balances.total[c]));

      const deposits = await exchange.fetchDeposits(undefined, Date.now() - 90 * 86400 * 1000);
      const withdrawals = await exchange.fetchWithdrawals(undefined, Date.now() - 90 * 86400 * 1000);

      deposits.forEach((d: any) => currencies.add(d.currency));
      withdrawals.forEach((w: any) => currencies.add(w.currency));

      const quoteCurrencies = ["USDT", "USD", "BTC", "JPY", "ETH"];
      const marketsToFetch = Object.keys(exchange.markets).filter((symbol) => {
        const market = exchange.markets[symbol];
        return (
          market.spot &&
          currencies.has(market.base) &&
          quoteCurrencies.includes(market.quote)
        );
      });

      console.log(`[ALL] ${marketsToFetch.length} markets to fetch for ${acc.exchange}`);

      for (const market of marketsToFetch) {
        const res = await fetch(`${FUNCTION_ENDPOINT}/exchange-sync-worker`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            exchange: acc.exchange,
            market,
            api_key_encrypted: acc.api_key_encrypted,
            api_secret_encrypted: acc.api_secret_encrypted,
            user_id: user.id,
          }),
        });

        if (!res.ok) {
          console.warn(`[ALL] Worker failed for ${market}: ${await res.text()}`);
          continue;
        }

        const { totalSaved: saved } = await res.json();
        totalSaved += saved;
      }
    }

    return new Response(JSON.stringify({ message: "Sync complete", totalSaved }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[SYNC-ALL ERROR]", e);
    return new Response(`Internal Error: ${e.message}`, { status: 500 });
  }
});

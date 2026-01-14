// supabase/functions/payment-create-link/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_VALUES = new Set([
  "Polygon", "Ethereum", "Arbitrum", "Base", "BTC", "USDC", "JPYC"
]);

const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST,OPTIONS",
  "content-type": "application/json",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors(origin) });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE)
      throw new Error("server_misconfigured");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer "))
      throw new Error("no_token");
    const token = authz.slice("Bearer ".length);

    const { data: u, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !u?.user) throw new Error("auth_failed");
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const title = body?.title;
    const amount = Number(body?.amount);
    const currency = body?.currency ?? "USD";
    const requested = Array.isArray(body?.requested_networks) ? body.requested_networks : [];

    if (!title || !Number.isFinite(amount) || amount <= 0)
      throw new Error("bad_request");

    const { data: merchant, error: mErr } = await supabase
      .from("payment_merchants")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (mErr) throw new Error("merchant_read_failed");
    if (!merchant) throw new Error("merchant_not_found");

    const configured = Array.isArray(merchant.allowed_networks) ? merchant.allowed_networks : [];
    const effective = (requested.length ? requested : configured).filter((v: string) => ALLOWED_VALUES.has(v));
    if (effective.length === 0)
      throw new Error("no_allowed_networks");

    const { data: link, error: lErr } = await supabase
      .from("payment_links")
      .insert({
        user_id: userId,
        title,
        amount,
        currency,
        status: "draft",
      })
      .select()
      .single();

    if (lErr || !link) throw new Error("create_link_failed");

    const paymentUrl = `${SUPABASE_URL.replace(".supabase.co", ".functions.supabase.co")}/pay/${link.id}`;

    return new Response(JSON.stringify({
      ok: true,
      link_id: link.id,
      payment_url: paymentUrl,
      allowed_networks_effective: effective,
    }), { status: 200, headers: cors(origin) });

  } catch (e: any) {
    return new Response(JSON.stringify({
      error: e.message ?? "panic",
    }), { status: 500, headers: cors(req.headers.get("origin")) });
  }
});

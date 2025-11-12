// Deno Deploy ランタイムを想定（Supabase Edge Functions）
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

type Provider = "binance";

const BINANCE_BASE = "https://api.binance.com";
const KMS_KEY = Deno.env.get("EXCHANGE_KMS_KEY") ?? "";

function signBinance(query: string, secret: string) {
  // Binance signature = HMAC SHA256 (query) hex
  return hmac("sha256", secret, query, "hex").toString();
}

function qs(obj: Record<string, string | number>) {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function decryptSecret(supabase: any, enc: Uint8Array) {
  // Postgres復号をRPCで実施（DB側で pgp_sym_decrypt）
  const { data, error } = await supabase.rpc("decrypt_secret", {
    enc_input: enc,
    key_input: KMS_KEY,
  });
  if (error) throw error;
  return data as string;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "test";
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return new Response("Unauthorized", { status: 401 });

    if (req.method === "POST" && action === "link") {
      const body = await req.json();
      const { provider, api_key, api_secret, label } = body as {
        provider: Provider; api_key: string; api_secret: string; label?: string;
      };
      if (provider !== "binance") throw new Error("Unsupported provider");

      const { data, error } = await supabase.rpc("encrypt_secret", {
        plain_input: api_secret,
        key_input: KMS_KEY,
      });
      if (error) throw error;

      const { error: insErr } = await supabase
        .from("exchange_connections")
        .insert({
          user_id: user.user.id,
          provider,
          label,
          api_key,
          api_secret_enc: data
        });
      if (insErr) throw insErr;

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // 以降は既存接続IDを使って実リクエスト
    const connId = Number(url.searchParams.get("conn_id"));
    if (!connId) throw new Error("conn_id required");

    // 取得
    const { data: conn, error: selErr } = await supabase
      .from("exchange_connections")
      .select("*")
      .eq("id", connId)
      .single();
    if (selErr || !conn) throw selErr ?? new Error("connection not found");

    // 復号
    const secret = await decryptSecret(supabase, conn.api_secret_enc);
    const apiKey: string = conn.api_key;

    if (action === "test") {
      const timestamp = Date.now();
      const query = qs({ timestamp, recvWindow: 5000 });
      const sig = signBinance(query, secret);

      const res = await fetch(`${BINANCE_BASE}/api/v3/account?${query}&signature=${sig}`, {
        headers: { "X-MBX-APIKEY": apiKey },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.msg ?? res.statusText);

      return new Response(JSON.stringify({ ok: true, account: json }), { status: 200 });
    }

    if (action === "sync-lite") {
      const timestamp = Date.now();

      // 残高
      const q1 = qs({ timestamp, recvWindow: 5000 });
      const s1 = signBinance(q1, secret);
      const accRes = await fetch(`${BINANCE_BASE}/api/v3/account?${q1}&signature=${s1}`, {
        headers: { "X-MBX-APIKEY": apiKey },
      });
      const acc = await accRes.json();
      if (!accRes.ok) throw new Error(acc?.msg ?? accRes.statusText);

      // （例）残高を exchange_balances にupsert（最低限）
      const balances = (acc.balances ?? []).filter((b: any) => Number(b.free) > 0 || Number(b.locked) > 0);
      const rows = balances.map((b: any) => ({
        user_id: user.user.id,
        provider: "binance",
        asset: b.asset,
        free: b.free,
        locked: b.locked,
        fetched_at: new Date().toISOString(),
      }));
      if (rows.length) {
        await supabase.from("exchange_balances").upsert(rows, { onConflict: "user_id,provider,asset" });
      }

      // TODO: 入出金/トレードは /sapi を順次カバー（本PRは“準一致”の足掛かり）
      return new Response(JSON.stringify({ ok: true, balances: rows.length }), { status: 200 });
    }

    return new Response("Unknown action", { status: 400 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500 });
  }
});

// supabase/functions/exchange-sync/index.ts
// どんな失敗でも JSON { ok:false, step, error, details? } を返す診断版
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;
const CORS = (o: string | null) => ({
  "access-control-allow-origin": o ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST,OPTIONS",
  "content-type": "application/json",
});

const ok = (origin: string | null, body: Json, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS(origin) });

const fail = (origin: string | null, step: string, error: unknown, status = 500, extra?: Json) =>
  ok(origin, { ok: false, step, error: String((error as any)?.message ?? error), ...(extra ?? {}) }, status);

// ===== 共通ユーティリティ =====
function b64decode(b64: string) {
  const s = atob(b64); const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
async function importAesKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY missing");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}
async function decryptBlob(enc: string) {
  const [v, ivb64, ctb64] = enc.split(":");
  if (v !== "v1") throw new Error("unknown blob version");
  const key = await importAesKey();
  const iv = b64decode(ivb64);
  const ct = b64decode(ctb64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
}
const toMs = (v?: number | string | null) => {
  if (!v && v !== 0) return undefined;
  if (typeof v === "number") return v;
  const t = Date.parse(v); return Number.isFinite(t) ? t : undefined;
};

// ===== 取引所API（最低限）=====
async function binanceSigned(path: string, key: string, secret: string, params: Record<string,string>) {
  const qs = new URLSearchParams(params);
  qs.set("timestamp", String(Date.now()));
  const data = qs.toString();
  const sigKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", sigKey, new TextEncoder().encode(data));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  const url = `https://api.binance.com${path}?${data}&signature=${hex}`;
  const res = await fetch(url, { headers: { "X-MBX-APIKEY": key } });
  const text = await res.text();
  if (!res.ok) throw new Error(`binance ${path} ${res.status}: ${text}`);
  return JSON.parse(text);
}

// USDT建ての現物シンボルを自動推定
async function binanceSpotUsdtSymbols(key: string, secret: string) {
  // 署名不要エンドポイントに変えてもOKだが、ここでは一律署名形に寄せる
  // 代替: https://api.binance.com/api/v3/exchangeInfo でフィルタ（署名不要）
  const res = await fetch("https://api.binance.com/api/v3/exchangeInfo");
  const json = await res.json();
  const syms: string[] = [];
  for (const s of json.symbols ?? []) {
    if (s.status === "TRADING" && s.quoteAsset === "USDT" && s.permissions?.includes?.("SPOT")) {
      syms.push(s.symbol);
    }
  }
  // 多すぎてもAPIに弾かれるので代表上位だけにする（必要に応じ調整）
  return syms.slice(0, 50);
}

async function binanceTrades(key: string, secret: string, symbols: string[], sinceMs?: number, untilMs?: number) {
  const out: any[] = [];
  for (const sym of symbols) {
    const p: Record<string,string> = { symbol: sym, limit: "1000" };
    if (sinceMs) p.startTime = String(sinceMs);
    if (untilMs) p.endTime = String(untilMs);
    const arr = await binanceSigned("/api/v3/myTrades", key, secret, p);
    for (const t of arr) {
      out.push({
        trade_id: t.id,
        ts: t.time,
        symbol: t.symbol,
        side: t.isBuyer ? "buy" : "sell",
        qty: Number(t.qty ?? 0),
        price: Number(t.price ?? 0),
        fee: Number(t.commission ?? 0),
        fee_asset: t.commissionAsset ?? null,
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return ok(origin, { ok: true });

  try {
    if (req.method !== "POST") return fail(origin, "method", "Method Not Allowed", 405);

    // ---- 0. Supabase 初期化
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) return fail(origin, "env", "SUPABASE_URL or SERVICE_ROLE missing", 500);
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // ---- 1. 認証
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) return fail(origin, "auth", "no bearer token", 401);
    const token = authz.slice("Bearer ".length);
    const { data: u, error: uerr } = await sb.auth.getUser(token);
    if (uerr || !u?.user?.id) return fail(origin, "auth", uerr ?? "bad token", 401);
    const userId = u.user.id;

    // ---- 2. 入力
    const body = await req.json().catch(() => null) as {
      exchange?: "binance"|"bybit"|"okx";
      symbols?: string | null;
      since?: number|string|null;
      until?: number|string|null;
    } | null;
    if (!body?.exchange) return fail(origin, "input", "exchange missing", 400);
    const exchange = body.exchange;
    const sinceMs = toMs(body.since ?? null);
    const untilMs = toMs(body.until ?? null);
    const symbolsRaw = (body.symbols ?? "").toString().trim();

    // ---- 3. 資格情報
    const { data: cred, error: cerr } = await sb
      .from("exchange_api_credentials")
      .select("enc_blob, external_user_id")
      .eq("user_id", userId)
      .eq("exchange", exchange)
      .maybeSingle();
    if (cerr) return fail(origin, "credentials/select", cerr, 500);
    if (!cred?.enc_blob) return fail(origin, "credentials", "no stored credentials", 400);

    let secrets: any;
    try { secrets = await decryptBlob(cred.enc_blob); }
    catch (e) { return fail(origin, "credentials/decrypt", e, 500); }

    const apiKey = secrets.apiKey as string | undefined;
    const apiSecret = secrets.apiSecret as string | undefined;
    const apiPass = secrets.apiPassphrase as string | undefined;

    if (!apiKey || !apiSecret) return fail(origin, "credentials/format", "apiKey/apiSecret missing", 400);

    // ---- 4. 取引所別処理（まずは Binance を優先デバッグ）
    if (exchange === "binance") {
      let symbols: string[] = [];
      try {
        if (symbolsRaw) {
          symbols = symbolsRaw.split(",").map(s => s.trim()).filter(Boolean);
        } else {
          symbols = await binanceSpotUsdtSymbols(apiKey, apiSecret);
        }
        if (!symbols.length) return fail(origin, "binance/symbols", "no symbols resolved", 400);
      } catch (e) {
        return fail(origin, "binance/symbols", e, 500);
      }

      let trades: any[] = [];
      try {
        trades = await binanceTrades(apiKey, apiSecret, symbols, sinceMs, untilMs);
      } catch (e) {
        return fail(origin, "binance/myTrades", e, 500, { symbols, sinceMs, untilMs });
      }

      // 保存（最初はテーブル確認だけ）
      try {
        for (const t of trades) {
          await sb.from("exchange_trades").upsert({
            user_id: userId,
            exchange: "binance",
            external_user_id: cred.external_user_id ?? null,
            trade_id: String(t.trade_id),
            ts: new Date(t.ts).toISOString(),
            symbol: t.symbol,
            side: t.side,
            qty: t.qty,
            price: t.price,
            fee: t.fee,
            fee_asset: t.fee_asset,
            raw: t,
          }, { onConflict: "user_id,exchange,external_user_id,trade_id" });
        }
      } catch (e) {
        return fail(origin, "db/upsert", e, 500, { count: trades.length });
      }

      return ok(origin, { ok: true, exchange, inserted: trades.length });
    }

    // 他取引所は段階対応（ここに増やしていく）
    return fail(origin, "not-implemented", `exchange ${exchange} not implemented yet`, 400);
  } catch (e) {
    return fail(origin, "fatal", e, 500);
  }
});

// supabase/functions/exchange-sync/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ------------------------------
// Utility: Base64 decode
// ------------------------------
function b64decode(b64: string) {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

// ------------------------------
// KMS decrypt
// ------------------------------
async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY missing");

  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

async function decryptBlob(enc: string) {
  const key = await getKey();
  const parts = enc.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("bad enc_blob format");

  const iv = b64decode(parts[1]);
  const ct = b64decode(parts[2]);

  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  const txt = new TextDecoder().decode(pt);
  return JSON.parse(txt);
}

// ------------------------------
// CORS helper
// ------------------------------
const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin ?? "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
});

// ------------------------------
// Binance helpers
// ------------------------------
const BINANCE_ENDPOINT = "https://api.binance.com";

function signBinance(path: string, params: any, secret: string) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  const qs = usp.toString();
  const data = new TextEncoder().encode(qs);
  const keyBytes = new TextEncoder().encode(secret);

  return crypto.subtle
    .importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((key) => crypto.subtle.sign("HMAC", key, data))
    .then((sig) =>
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    )
    .then((signature) => `${path}?${qs}&signature=${signature}`);
}

async function binanceRequest(path: string, apiKey: string, apiSecret: string, params: any) {
  const timestamp = Date.now();
  const url =
    BINANCE_ENDPOINT + (await signBinance(path, { ...params, timestamp }, apiSecret));

  const res = await fetch(url, { method: "GET", headers: { "X-MBX-APIKEY": apiKey } });
  const text = await res.text();

  try {
    const json = JSON.parse(text);
    if (!res.ok) throw new Error(json.msg ?? text);
    return json;
  } catch {
    if (!res.ok) throw new Error(text);
    throw new Error("binance: bad json");
  }
}

// Binance は symbol が必須なので代表的シンボルを全巡回
const BINANCE_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

async function fetchBinanceTrades(
  apiKey: string,
  apiSecret: string,
  sinceMs: number | null,
  untilMs: number | null,
) {
  const params: any = { limit: 1000 };
  if (sinceMs) params.startTime = sinceMs;
  if (untilMs) params.endTime = untilMs;

  const all: any[] = [];
  for (const sym of BINANCE_SYMBOLS) {
    const rows = await binanceRequest("/api/v3/myTrades", apiKey, apiSecret, {
      ...params,
      symbol: sym,
    });
    if (Array.isArray(rows)) all.push(...rows);
  }
  return all;
}

async function fetchBinanceDeposits(
  apiKey: string,
  apiSecret: string,
  sinceMs: number | null,
  untilMs: number | null,
) {
  const params: any = {};
  if (sinceMs) params.startTime = sinceMs;
  if (untilMs) params.endTime = untilMs;
  const rows = await binanceRequest("/sapi/v1/capital/deposit/hisrec", apiKey, apiSecret, params);
  return Array.isArray(rows) ? rows : [];
}

async function fetchBinanceWithdraws(
  apiKey: string,
  apiSecret: string,
  sinceMs: number | null,
  untilMs: number | null,
) {
  const params: any = {};
  if (sinceMs) params.startTime = sinceMs;
  if (untilMs) params.endTime = untilMs;
  const rows = await binanceRequest("/sapi/v1/capital/withdraw/history", apiKey, apiSecret, params);
  return Array.isArray(rows) ? rows : [];
}

// ------------------------------
// Bybit helpers
// ------------------------------
const BYBIT_ENDPOINT = "https://api.bybit.com";

function signBybit(path: string, params: any, key: string, secret: string) {
  const timestamp = Date.now().toString();
  const recvWindow = "60000";
  const qs = new URLSearchParams(params).toString();
  const payload = timestamp + key + recvWindow + qs;

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const keyBytes = encoder.encode(secret);

  return crypto.subtle
    .importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((k) => crypto.subtle.sign("HMAC", k, data))
    .then((sig) =>
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    )
    .then((signature) => ({
      url: `${BYBIT_ENDPOINT}${path}?${qs}`,
      headers: {
        "X-BAPI-API-KEY": key,
        "X-BAPI-SIGN": signature,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": recvWindow,
      },
    }));
}

async function bybitRequest(path: string, apiKey: string, apiSecret: string, params: any) {
  const { url, headers } = await signBybit(path, params, apiKey, apiSecret);
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("bybit: bad json");
  }
  if (!res.ok || json.retCode !== 0) throw new Error(json.retMsg ?? text);
  return json;
}

async function fetchBybitTrades(
  apiKey: string,
  apiSecret: string,
  sinceMs: number | null,
  untilMs: number | null,
) {
  const params: any = { category: "linear" };
  if (sinceMs) params.startTime = sinceMs;
  if (untilMs) params.endTime = untilMs;
  const j = await bybitRequest("/v5/execution/list", apiKey, apiSecret, params);
  return j.result?.list ?? [];
}

async function fetchBybitDeposits(
  apiKey: string,
  apiSecret: string,
  sinceMs: number | null,
  untilMs: number | null,
) {
  const params: any = {};
  if (sinceMs) params.startTime = sinceMs;
  if (untilMs) params.endTime = untilMs;
  const j = await bybitRequest("/v5/asset/deposit/query-record", apiKey, apiSecret, params);
  return j.result?.rows ?? [];
}

async function fetchBybitWithdraws(
  apiKey: string,
  apiSecret: string,
  sinceMs: number | null,
  untilMs: number | null,
) {
  const params: any = {};
  if (sinceMs) params.startTime = sinceMs;
  if (untilMs) params.endTime = untilMs;
  const j = await bybitRequest("/v5/asset/withdraw/query-record", apiKey, apiSecret, params);
  return j.result?.rows ?? [];
}

// ------------------------------
// OKX helpers
// ------------------------------
const OKX_ENDPOINT = "https://www.okx.com";

function okxSign(
  method: string,
  path: string,
  params: any,
  apiKey: string,
  secret: string,
  passphrase: string,
) {
  const ts = new Date().toISOString();
  const qs = new URLSearchParams(params).toString();
  const prehash = ts + method.toUpperCase() + path + (qs ? `?${qs}` : "");

  const encoder = new TextEncoder();
  const data = encoder.encode(prehash);
  const keyBytes = encoder.encode(secret);

  return crypto.subtle
    .importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((k) => crypto.subtle.sign("HMAC", k, data))
    .then((sig) =>
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    )
    .then((signature) => ({
      url: `${OKX_ENDPOINT}${path}${qs ? `?${qs}` : ""}`,
      headers: {
        "OK-ACCESS-KEY": apiKey,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-TIMESTAMP": ts,
        "OK-ACCESS-PASSPHRASE": passphrase,
      },
    }));
}

async function okxRequest(
  path: string,
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  params: any,
) {
  const { url, headers } = await okxSign("GET", path, params, apiKey, apiSecret, passphrase);
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("okx: bad json");
  }
  if (!res.ok || json.code !== "0") throw new Error(json.msg ?? text);
  return json;
}

async function fetchOkxTrades(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  sinceMs: number | null,
  untilMs: number | null,
) {
  const params: any = { instType: "SPOT" };
  if (sinceMs) params.begin = sinceMs;
  if (untilMs) params.end = untilMs;
  const j = await okxRequest("/api/v5/trade/fills", apiKey, apiSecret, passphrase, params);
  return j.data ?? [];
}

async function fetchOkxDeposits(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  sinceMs: number | null,
) {
  const params: any = {};
  if (sinceMs) params.after = sinceMs;
  const j = await okxRequest("/api/v5/asset/deposit-history", apiKey, apiSecret, passphrase, params);
  return j.data ?? [];
}

async function fetchOkxWithdraws(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  sinceMs: number | null,
) {
  const params: any = {};
  if (sinceMs) params.after = sinceMs;
  const j = await okxRequest(
    "/api/v5/asset/withdrawal-history",
    apiKey,
    apiSecret,
    passphrase,
    params,
  );
  return j.data ?? [];
}

// ------------------------------
// DB helpers
// ------------------------------

// ✅ exchange_accounts テーブルの実スキーマに合わせた実装
//   - 少なくとも id は存在している（FK で参照されている）
//   - 他のカラム（user_id / exchange / external_user_id）は存在しないので一切使わない
async function ensureExchangeAccountId(
  supabase: any,
  _exchange: string,
  _external_user_id: string | null,
) {
  // 既存があればそれを使う（最初の 1 行）
  const { data, error } = await supabase
    .from("exchange_accounts")
    .select("id")
    .order("id", { ascending: true })
    .limit(1);

  if (error) throw new Error(`ensureExchangeAccountId(select): ${error.message}`);
  if (data && data.length > 0) return data[0].id as number;

  // 1 行も無ければ空レコードを作成
  const { data: inserted, error: insErr } = await supabase
    .from("exchange_accounts")
    .insert({})
    .select("id")
    .single();

  if (insErr) throw new Error(`ensureExchangeAccountId(insert): ${insErr.message}`);
  return inserted?.id ?? null;
}

// Trades → exchange_trades
async function saveTrades(
  supabase: any,
  userId: string,
  exchange: string,
  external_user_id: string | null,
  items: any[],
) {
  const rows = items.map((it) => ({
    user_id: userId,
    exchange,
    external_user_id,
    external_account_id: null,
    raw: it,
    executed_at: new Date(it.time ?? it.execTime ?? it.ts ?? Date.now()).toISOString(),
    symbol: it.symbol ?? it.instId ?? null,
    side: it.side ?? null,
    qty: Number(it.qty ?? it.cumExecQty ?? it.sz ?? 0) || 0,
    price: Number(it.price ?? it.avgPrice ?? it.fillPx ?? 0) || 0,
    fee: Number(it.commission ?? it.fee ?? it.fees ?? 0) || 0,
    fee_currency: it.commissionAsset ?? it.feeAsset ?? it.feeCcy ?? null,
  }));

  const { error } = await supabase.from("exchange_trades").upsert(rows, {
    onConflict: "user_id,exchange,external_user_id,symbol,executed_at,qty,price",
  });
  if (error) throw new Error(`saveTrades: ${error.message}`);
}

// Transfers → exchange_transfers
async function saveTransfers(
  supabase: any,
  userId: string,
  exchange: string,
  external_user_id: string | null,
  kind: "deposit" | "withdrawal",
  items: any[],
) {
  const accountId = await ensureExchangeAccountId(supabase, exchange, external_user_id);

  const rows = items.map((it) => ({
    account_id: accountId,
    direction: kind === "deposit" ? "in" : "out",
    asset: it.coin ?? it.asset ?? it.ccy ?? null,
    amount: Number(it.amount ?? it.qty ?? it.sz ?? 0) || 0,
    txid: it.txId ?? it.id ?? it.trxId ?? null,
    network: it.network ?? it.chain ?? it.chainName ?? null,
    occurred_at: new Date(
      it.insertTime ?? it.applyTime ?? it.ts ?? it.fillTime ?? Date.now(),
    ).toISOString(),
    raw: it,
  }));

  const { error } = await supabase.from("exchange_transfers").upsert(rows, {
    onConflict: "account_id,txid,occurred_at,asset,amount",
  });
  if (error) throw new Error(`saveTransfers: ${error.message}`);
}

// ------------------------------
// Main handler
// ------------------------------
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: cors(origin) });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: cors(origin),
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "server_misconfigured" }), {
        status: 500,
        headers: cors(origin),
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Auth
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "no_token" }), {
        status: 401,
        headers: cors(origin),
      });
    }

    const token = authz.slice("Bearer ".length);
    const { data: u, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !u?.user?.id) {
      return new Response(JSON.stringify({ error: "auth_error" }), {
        status: 401,
        headers: cors(origin),
      });
    }
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const exchange: string = body.exchange;

    if (!["binance", "bybit", "okx"].includes(exchange)) {
      return new Response(JSON.stringify({ error: "bad_exchange" }), {
        status: 400,
        headers: cors(origin),
      });
    }

    const kinds: string[] = body.kinds?.length
      ? body.kinds
      : ["spot_trades", "deposits", "withdrawals"];

    const sinceMs = body.since ? Date.parse(body.since) : null;
    const untilMs = body.until ? Date.parse(body.until) : null;

    // credentials
    const { data: credRow, error: credErr } = await supabase
      .from("exchange_api_credentials")
      .select("enc_blob, external_user_id")
      .eq("user_id", userId)
      .eq("exchange", exchange)
      .maybeSingle();

    if (credErr) {
      return new Response(
        JSON.stringify({ error: "credentials_read_failed", details: credErr.message }),
        { status: 500, headers: cors(origin) },
      );
    }
    if (!credRow) {
      return new Response(JSON.stringify({ error: "no_credentials" }), {
        status: 400,
        headers: cors(origin),
      });
    }

    const { apiKey, apiSecret, apiPassphrase } = await decryptBlob(credRow.enc_blob);
    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "bad_credentials" }), {
        status: 400,
        headers: cors(origin),
      });
    }

    const external_user_id = credRow.external_user_id ?? null;

    let total = 0;
    let inserted = 0;
    const errors: string[] = [];

    async function save(items: any[]) {
      if (!items?.length) return;
      total += items.length;
      try {
        await saveTrades(supabase, userId, exchange, external_user_id, items);
        inserted += items.length;
      } catch (e: any) {
        errors.push(e?.message ?? String(e));
      }
    }

    // ---- fetch & save ----
    if (kinds.includes("spot_trades")) {
      if (exchange === "binance")
        await save(await fetchBinanceTrades(apiKey, apiSecret, sinceMs, untilMs));
      else if (exchange === "bybit")
        await save(await fetchBybitTrades(apiKey, apiSecret, sinceMs, untilMs));
      else if (exchange === "okx") {
        if (!apiPassphrase) throw new Error("okx: api_passphrase missing");
        await save(await fetchOkxTrades(apiKey, apiSecret, apiPassphrase, sinceMs, untilMs));
      }
    }

    if (kinds.includes("deposits")) {
      if (exchange === "binance")
        await saveTransfers(
          supabase,
          userId,
          exchange,
          external_user_id,
          "deposit",
          await fetchBinanceDeposits(apiKey, apiSecret, sinceMs, untilMs),
        );
      else if (exchange === "bybit")
        await saveTransfers(
          supabase,
          userId,
          exchange,
          external_user_id,
          "deposit",
          await fetchBybitDeposits(apiKey, apiSecret, sinceMs, untilMs),
        );
      else if (exchange === "okx") {
        if (!apiPassphrase) throw new Error("okx: api_passphrase missing");
        await saveTransfers(
          supabase,
          userId,
          exchange,
          external_user_id,
          "deposit",
          await fetchOkxDeposits(apiKey, apiSecret, apiPassphrase, sinceMs),
        );
      }
    }

    if (kinds.includes("withdrawals")) {
      if (exchange === "binance")
        await saveTransfers(
          supabase,
          userId,
          exchange,
          external_user_id,
          "withdrawal",
          await fetchBinanceWithdraws(apiKey, apiSecret, sinceMs, untilMs),
        );
      else if (exchange === "bybit")
        await saveTransfers(
          supabase,
          userId,
          exchange,
          external_user_id,
          "withdrawal",
          await fetchBybitWithdraws(apiKey, apiSecret, sinceMs, untilMs),
        );
      else if (exchange === "okx") {
        if (!apiPassphrase) throw new Error("okx: api_passphrase missing");
        await saveTransfers(
          supabase,
          userId,
          exchange,
          external_user_id,
          "withdrawal",
          await fetchOkxWithdraws(apiKey, apiSecret, apiPassphrase, sinceMs),
        );
      }
    }

    return new Response(JSON.stringify({ ok: true, total, inserted, errors }), {
      status: 200,
      headers: cors(origin),
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: cors(origin),
    });
  }
});

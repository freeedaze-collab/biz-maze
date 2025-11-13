// supabase/functions/exchange-sync/index.ts
// 依存なし（edge-runtime の import 不要）
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- 共通ユーティリティ ----------
const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST,OPTIONS",
  "content-type": "application/json",
});

function b64dec(b64: string) {
  const s = atob(b64); const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
async function getDecryptKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY missing");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}
async function decryptBlob(enc: string) {
  const [v, ivb64, ctb64] = enc.split(":");
  if (v !== "v1") throw new Error("unknown blob version");
  const key = await getDecryptKey();
  const iv = b64dec(ivb64);
  const ct = b64dec(ctb64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
}

type Body = {
  exchange: "binance" | "bybit" | "okx";
  symbols?: string | null;      // Binance 用: "BTCUSDT,ETHUSDT"。null/空なら自動推定
  since?: number | string | null;
  until?: number | string | null;
  kinds?: ("trades" | "deposits" | "withdrawals")[];
};

function toMs(v?: number | string | null) {
  if (!v) return undefined;
  if (typeof v === "number") return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
}

async function saveTrades(
  supabase: any, userId: string, exchange: string, external_user_id: string | null, items: any[],
) {
  for (const it of items) {
    const payload = {
      user_id: userId,
      exchange,
      external_user_id,
      trade_id: String(it.trade_id),
      ts: new Date(it.ts).toISOString(),
      symbol: it.symbol,
      side: it.side,
      qty: it.qty ?? null,
      price: it.price ?? null,
      fee: it.fee ?? null,
      fee_asset: it.fee_asset ?? null,
      raw: it,
    };
    await supabase
      .from("exchange_trades")
      .upsert(payload, { onConflict: "user_id,exchange,external_user_id,trade_id" });
  }
}

// ---------- Binance helpers ----------
async function binanceSignedFetch(
  path: string, key: string, secret: string, params: Record<string, string>,
) {
  const qs = new URLSearchParams(params);
  qs.set("timestamp", String(Date.now()));
  const data = qs.toString();
  const sigKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", sigKey, new TextEncoder().encode(data));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  const url = `https://api.binance.com${path}?${data}&signature=${hex}`;
  const res = await fetch(url, { headers: { "X-MBX-APIKEY": key } });
  const text = await res.text();
  if (!res.ok) throw new Error(`binance ${path} ${res.status}: ${text}`);
  return JSON.parse(text);
}

// symbols 未指定 → /api/v3/exchangeInfo から USDT建て現物の TRADING のみを抽出
async function binanceAutoSymbols(): Promise<string[]> {
  const url = "https://api.binance.com/api/v3/exchangeInfo";
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`binance exchangeInfo ${res.status}: ${text}`);
  const json = JSON.parse(text);
  const arr: string[] = [];
  for (const s of json.symbols ?? []) {
    if (s.status === "TRADING" && s.quoteAsset === "USDT" && s.isSpotTradingAllowed) {
      arr.push(s.symbol);
    }
  }
  return arr;
}

async function fetchBinanceTrades(
  key: string, secret: string, symbols: string[], sinceMs?: number, untilMs?: number,
) {
  const out: any[] = [];
  for (const sym of symbols) {
    const params: Record<string, string> = { symbol: sym, limit: "1000" };
    if (sinceMs) params.startTime = String(sinceMs);
    if (untilMs) params.endTime = String(untilMs);
    const arr = await binanceSignedFetch("/api/v3/myTrades", key, secret, params);
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

async function fetchBinanceDeposits(key: string, secret: string, sinceMs?: number, untilMs?: number) {
  const params: Record<string, string> = {};
  if (sinceMs) params.startTime = String(sinceMs);
  if (untilMs) params.endTime = String(untilMs);
  const arr = await binanceSignedFetch("/sapi/v1/capital/deposit/hisrec", key, secret, params);
  return arr.map((d: any) => ({
    trade_id: `dep_${d.txId ?? crypto.randomUUID()}`,
    ts: d.insertTime,
    symbol: d.coin,
    side: "buy",
    qty: Number(d.amount ?? 0),
    price: null,
    fee: 0,
    fee_asset: d.coin,
  }));
}

async function fetchBinanceWithdraws(key: string, secret: string, sinceMs?: number, untilMs?: number) {
  const params: Record<string, string> = {};
  if (sinceMs) params.startTime = String(sinceMs);
  if (untilMs) params.endTime = String(untilMs);
  const arr = await binanceSignedFetch("/sapi/v1/capital/withdraw/history", key, secret, params);
  return arr.map((w: any) => ({
    trade_id: `wd_${w.id ?? crypto.randomUUID()}`,
    ts: w.applyTime ? Date.parse(w.applyTime) : Date.now(),
    symbol: w.coin,
    side: "sell",
    qty: Number(w.amount ?? 0),
    price: null,
    fee: Number(w.transactionFee ?? 0),
    fee_asset: w.coin,
  }));
}

// ---------- Bybit ----------
async function bybitSignedFetch(
  path: string, key: string, secret: string, query?: URLSearchParams, method = "GET", body = "",
) {
  const ts = String(Date.now());
  const recvWindow = "5000";
  const signPayload = ts + key + recvWindow + (method === "GET" ? (query?.toString() ?? "") : body);
  const sigKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigRaw = await crypto.subtle.sign("HMAC", sigKey, new TextEncoder().encode(signPayload));
  const sign = Array.from(new Uint8Array(sigRaw)).map(b => b.toString(16).padStart(2, "0")).join("");
  const url = `https://api.bybit.com${path}${method === "GET" && query ? `?${query.toString()}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      "X-BAPI-API-KEY": key,
      "X-BAPI-SIGN": sign,
      "X-BAPI-TIMESTAMP": ts,
      "X-BAPI-RECV-WINDOW": recvWindow,
      "Content-Type": "application/json",
    },
    body: method === "GET" ? undefined : body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`bybit ${path} ${res.status}: ${text}`);
  return JSON.parse(text);
}
async function fetchBybitTrades(key: string, secret: string, sinceMs?: number, untilMs?: number) {
  const qs = new URLSearchParams({ category: "spot" });
  if (sinceMs) qs.set("startTime", String(sinceMs));
  if (untilMs) qs.set("endTime", String(untilMs));
  const json = await bybitSignedFetch("/v5/execution/list", key, secret, qs);
  const list = json?.result?.list ?? [];
  return list.map((t: any) => ({
    trade_id: t.execId,
    ts: Number(t.execTime ?? Date.parse(t.execTime) ?? Date.now()),
    symbol: t.symbol,
    side: (t.side || "").toLowerCase(),
    qty: Number(t.execQty ?? t.qty ?? 0),
    price: Number(t.execPrice ?? t.price ?? 0),
    fee: Number(t.fee ?? 0),
    fee_asset: t.feeAsset ?? null,
  }));
}
async function fetchBybitDeposits(key: string, secret: string, sinceMs?: number, untilMs?: number) {
  const qs = new URLSearchParams();
  if (sinceMs) qs.set("startTime", String(sinceMs));
  if (untilMs) qs.set("endTime", String(untilMs));
  const json = await bybitSignedFetch("/v5/asset/deposit/query-record", key, secret, qs);
  const list = json?.result?.rows ?? [];
  return list.map((d: any) => ({
    trade_id: `dep_${d.txID ?? crypto.randomUUID()}`,
    ts: Number(d.successAt ?? d.createdTime ?? Date.now()),
    symbol: d.coin,
    side: "buy",
    qty: Number(d.amount ?? 0),
    price: null,
    fee: 0,
    fee_asset: d.coin,
  }));
}
async function fetchBybitWithdraws(key: string, secret: string, sinceMs?: number, untilMs?: number) {
  const qs = new URLSearchParams();
  if (sinceMs) qs.set("startTime", String(sinceMs));
  if (untilMs) qs.set("endTime", String(untilMs));
  const json = await bybitSignedFetch("/v5/asset/withdraw/query-record", key, secret, qs);
  const list = json?.result?.rows ?? [];
  return list.map((w: any) => ({
    trade_id: `wd_${w.id ?? crypto.randomUUID()}`,
    ts: Number(w.successAt ?? w.createdTime ?? Date.now()),
    symbol: w.coin,
    side: "sell",
    qty: Number(w.quantity ?? w.amount ?? 0),
    price: null,
    fee: Number(w.withdrawFee ?? 0),
    fee_asset: w.coin,
  }));
}

// ---------- OKX ----------
async function okxSignedFetch(
  path: string, key: string, secret: string, passphrase: string, method = "GET", query?: URLSearchParams, body = "",
) {
  const ts = new Date().toISOString();
  const prehash = ts + method + path + (method === "GET" ? (query ? `?${query.toString()}` : "") : body);
  const sigKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signRaw = await crypto.subtle.sign("HMAC", sigKey, new TextEncoder().encode(prehash));
  const sign = btoa(String.fromCharCode(...new Uint8Array(signRaw)));
  const url = `https://www.okx.com${path}${method === "GET" && query ? `?${query.toString()}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      "OK-ACCESS-KEY": key,
      "OK-ACCESS-SIGN": sign,
      "OK-ACCESS-TIMESTAMP": ts,
      "OK-ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
    },
    body: method === "GET" ? undefined : body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`okx ${path} ${res.status}: ${text}`);
  return JSON.parse(text);
}
async function fetchOkxTrades(key: string, secret: string, passphrase: string, sinceMs?: number, untilMs?: number) {
  const qs = new URLSearchParams();
  if (sinceMs) qs.set("begin", String(sinceMs));
  if (untilMs) qs.set("end", String(untilMs));
  const json = await okxSignedFetch("/api/v5/trade/fills", key, secret, passphrase, "GET", qs);
  const data = json?.data ?? [];
  return data.map((t: any) => ({
    trade_id: t.tradeId,
    ts: Date.parse(t.fillTime || t.ts || new Date().toISOString()),
    symbol: t.instId,
    side: (t.side || "").toLowerCase(),
    qty: Number(t.fillSz ?? t.sz ?? 0),
    price: Number(t.fillPx ?? t.px ?? 0),
    fee: Number(t.fee ?? 0),
    fee_asset: t.feeCcy ?? null,
  }));
}
async function fetchOkxDeposits(key: string, secret: string, passphrase: string, sinceMs?: number) {
  const qs = new URLSearchParams();
  if (sinceMs) qs.set("after", String(sinceMs));
  const json = await okxSignedFetch("/api/v5/asset/deposit-history", key, secret, passphrase, "GET", qs);
  const data = json?.data ?? [];
  return data.map((d: any) => ({
    trade_id: `dep_${d.txId ?? crypto.randomUUID()}`,
    ts: Date.parse(d.ts ?? new Date().toISOString()),
    symbol: d.ccy,
    side: "buy",
    qty: Number(d.amt ?? 0),
    price: null,
    fee: 0,
    fee_asset: d.ccy,
  }));
}
async function fetchOkxWithdraws(key: string, secret: string, passphrase: string, sinceMs?: number) {
  const qs = new URLSearchParams();
  if (sinceMs) qs.set("after", String(sinceMs));
  const json = await okxSignedFetch("/api/v5/asset/withdrawal-history", key, secret, passphrase, "GET", qs);
  const data = json?.data ?? [];
  return data.map((w: any) => ({
    trade_id: `wd_${w.wdId ?? crypto.randomUUID()}`,
    ts: Date.parse(w.ts ?? new Date().toISOString()),
    symbol: w.ccy,
    side: "sell",
    qty: Number(w.amt ?? 0),
    price: null,
    fee: Number(w.fee ?? 0),
    fee_asset: w.ccy,
  }));
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  const step = (s: string, obj: any = {}) =>
    new Response(JSON.stringify({ error: "internal_error", step: s, ...obj }), { status: 500, headers: cors(origin) });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors(origin) });
    }

    // Secrets の存在確認（不足なら 500 で具体的に返す）
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const EDGE_KMS_KEY = Deno.env.get("EDGE_KMS_KEY");
    if (!SUPABASE_URL) return step("missing_SUPABASE_URL");
    if (!SERVICE_ROLE) return step("missing_SERVICE_ROLE_KEY");
    if (!EDGE_KMS_KEY) return step("missing_EDGE_KMS_KEY");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 認証
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "no_token" }), { status: 401, headers: cors(origin) });
    }
    const token = authz.slice("Bearer ".length);
    const { data: u, error: uerr } = await supabase.auth.getUser(token);
    if (uerr) return step("getUser_failed", { details: uerr.message });
    const userId = u?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "bad_token" }), { status: 401, headers: cors(origin) });

    // 入力
    let body: Body;
    try { body = await req.json() as Body; }
    catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: cors(origin) }); }

    const exchange = body.exchange;
    if (!["binance","bybit","okx"].includes(exchange)) {
      return new Response(JSON.stringify({ error: "bad_exchange" }), { status: 400, headers: cors(origin) });
    }
    const sinceMs = toMs(body.since);
    const untilMs = toMs(body.until);
    const kinds = body.kinds?.length ? body.kinds : ["trades", "deposits", "withdrawals"];

    // 資格情報の取得 & 復号
    const { data: credRow, error: credErr } = await supabase
      .from("exchange_api_credentials")
      .select("enc_blob, external_user_id")
      .eq("user_id", userId)
      .eq("exchange", exchange)
      .maybeSingle();
    if (credErr) return step("select_credentials_failed", { details: credErr.message });
    if (!credRow?.enc_blob) {
      return new Response(JSON.stringify({ error: "no_credentials" }), { status: 400, headers: cors(origin) });
    }

    let secretObj: any;
    try { secretObj = await decryptBlob(credRow.enc_blob); }
    catch (e) { return step("decrypt_failed", { details: String(e?.message ?? e) }); }

    const apiKey = secretObj.apiKey as string;
    const apiSecret = secretObj.apiSecret as string;
    const apiPassphrase = secretObj.apiPassphrase as (string | null);
    const extId = credRow.external_user_id ?? null;

    // 実行
    let inserted = 0, errors = 0, total = 0;
    async function save(list: any[]) {
      total += list.length;
      try { await saveTrades(supabase, userId, exchange, extId, list); inserted += list.length; }
      catch (e) { errors += list.length; }
    }

    if (kinds.includes("trades")) {
      if (exchange === "binance") {
        let symbols: string[] = [];
        if (body.symbols && body.symbols.trim()) {
          symbols = body.symbols.split(",").map(s => s.trim()).filter(Boolean);
        } else {
          try { symbols = await binanceAutoSymbols(); }
          catch (e) { return step("binance_auto_symbols_failed", { details: String(e?.message ?? e) }); }
        }
        try { await save(await fetchBinanceTrades(apiKey, apiSecret, symbols, sinceMs, untilMs)); }
        catch (e) { return step("binance_trades_failed", { details: String(e?.message ?? e) }); }
      } else if (exchange === "bybit") {
        try { await save(await fetchBybitTrades(apiKey, apiSecret, sinceMs, untilMs)); }
        catch (e) { return step("bybit_trades_failed", { details: String(e?.message ?? e) }); }
      } else if (exchange === "okx") {
        if (!apiPassphrase) return step("okx_passphrase_missing");
        try { await save(await fetchOkxTrades(apiKey, apiSecret, apiPassphrase, sinceMs, untilMs)); }
        catch (e) { return step("okx_trades_failed", { details: String(e?.message ?? e) }); }
      }
    }

    if (kinds.includes("deposits")) {
      try {
        if (exchange === "binance") await save(await fetchBinanceDeposits(apiKey, apiSecret, sinceMs, untilMs));
        else if (exchange === "bybit") await save(await fetchBybitDeposits(apiKey, apiSecret, sinceMs, untilMs));
        else {
          if (!apiPassphrase) return step("okx_passphrase_missing");
          await save(await fetchOkxDeposits(apiKey, apiSecret, apiPassphrase, sinceMs));
        }
      } catch (e) {
        return step(`${exchange}_deposits_failed`, { details: String(e?.message ?? e) });
      }
    }

    if (kinds.includes("withdrawals")) {
      try {
        if (exchange === "binance") await save(await fetchBinanceWithdraws(apiKey, apiSecret, sinceMs, untilMs));
        else if (exchange === "bybit") await save(await fetchBybitWithdraws(apiKey, apiSecret, sinceMs, untilMs));
        else {
          if (!apiPassphrase) return step("okx_passphrase_missing");
          await save(await fetchOkxWithdraws(apiKey, apiSecret, apiPassphrase, sinceMs));
        }
      } catch (e) {
        return step(`${exchange}_withdrawals_failed`, { details: String(e?.message ?? e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, total, inserted, errors }), { status: 200, headers: cors(origin) });
  } catch (e) {
    // 想定外例外
    return new Response(JSON.stringify({ error: "panic", details: String(e?.message ?? e) }), {
      status: 500, headers: cors(null),
    });
  }
});

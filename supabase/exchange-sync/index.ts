// supabase/functions/exchange-sync/index.ts
// 依存なし（edge-runtime の import は不要）
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function b64decode(b64: string) {
  const s = atob(b64); const u8 = new Uint8Array(s.length);
  for (let i=0;i<s.length;i++) u8[i] = s.charCodeAt(i);
  return u8;
}
async function getKey() {
  const b64 = Deno.env.get("EDGE_KMS_KEY");
  if (!b64) throw new Error("EDGE_KMS_KEY missing");
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}
async function decryptBlob(enc: string) {
  const [v, ivb64, ctb64] = enc.split(":");
  if (v !== "v1") throw new Error("unknown blob version");
  const key = await getKey();
  const iv = b64decode(ivb64);
  const ct = b64decode(ctb64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
}
const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST,OPTIONS",
  "content-type": "application/json",
});
type Body = {
  exchange: "binance" | "bybit" | "okx";
  symbols?: string | null;          // Binance用: "BTCUSDT,ETHUSDT" / null=ALL
  since?: number | string;          // ms or ISO
  until?: number | string;          // ms or ISO
  kinds?: ("trades" | "deposits" | "withdrawals")[];
};
function toMs(v?: number|string|null) {
  if (!v) return undefined;
  if (typeof v === "number") return v;
  const t = Date.parse(v); return Number.isFinite(t) ? t : undefined;
}

// ---------- 保存（簡易版：1件ずつ upsert） ----------
async function saveTrades(supabase: any, userId: string, exchange: string, external_user_id: string | null, items: any[]) {
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

// ================= Binance =================
async function binanceSignedFetch(path: string, key: string, secret: string, params: Record<string,string>) {
  const qs = new URLSearchParams(params);
  qs.set("timestamp", String(Date.now()));
  const data = qs.toString();
  const sigKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", sigKey, new TextEncoder().encode(data));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,"0")).join("");
  const url = `https://api.binance.com${path}?${data}&signature=${hex}`;
  const res = await fetch(url, { headers: { "X-MBX-APIKEY": key } });
  const text = await res.text();
  if (!res.ok) throw new Error(`binance ${path} ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function fetchBinanceExchangeInfo() {
  const res = await fetch("https://api.binance.com/api/v3/exchangeInfo");
  if (!res.ok) throw new Error(`binance exchangeInfo ${res.status}`);
  const j = await res.json();
  const set = new Set<string>();
  for (const s of j?.symbols ?? []) set.add(String(s.symbol).toUpperCase());
  return set;
}

/** symbols 未指定時、保有資産から USDT ペアを推定（なければ定番のバックアップ） */
async function resolveBinanceSymbolsAll(key: string, secret: string) {
  const infoSet = await fetchBinanceExchangeInfo();

  // 1) アカウント残高から非ゼロ資産を抽出
  const acct = await binanceSignedFetch("/api/v3/account", key, secret, {});
  const nonZero: string[] = (acct?.balances ?? [])
    .filter((b: any) => Number(b.free) > 0 || Number(b.locked) > 0)
    .map((b: any) => String(b.asset).toUpperCase())
    .filter((a: string) => a !== "USDT");

  // 2) USDT ペアにして存在チェック
  let syms = nonZero
    .map((a) => `${a}USDT`)
    .filter((s) => infoSet.has(s));

  // 3) バックアップ（最低限）
  if (syms.length === 0) {
    const fallback = ["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"];
    syms = fallback.filter((s) => infoSet.has(s));
  }
  return syms;
}

async function fetchBinanceTrades(key: string, secret: string, symbols: string[], sinceMs?: number, untilMs?: number) {
  const out: any[] = [];
  for (const sym of symbols) {
    const params: Record<string,string> = { symbol: sym, limit: "1000" };
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
  const params: Record<string,string> = {};
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
  const params: Record<string,string> = {};
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

// ================= Bybit (v5) =================
async function bybitSignedFetch(path: string, key: string, secret: string, query?: URLSearchParams, method="GET", body="") {
  const ts = String(Date.now());
  const recvWindow = "5000";
  const signPayload = ts + key + recvWindow + (method === "GET" ? (query?.toString() ?? "") : body);
  const sigKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigRaw = await crypto.subtle.sign("HMAC", sigKey, new TextEncoder().encode(signPayload));
  const sign = Array.from(new Uint8Array(sigRaw)).map(b => b.toString(16).padStart(2,"0")).join("");
  const url = `https://api.bybit.com${path}${method==="GET" && query ? `?${query.toString()}` : ""}`;
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

// ================= OKX =================
async function okxSignedFetch(path: string, key: string, secret: string, passphrase: string, method="GET", query?: URLSearchParams, body="") {
  const ts = new Date().toISOString();
  const prehash = ts + method + path + (method === "GET" ? (query ? `?${query.toString()}` : "") : body);
  const sigKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signRaw = await crypto.subtle.sign("HMAC", sigKey, new TextEncoder().encode(prehash));
  const sign = btoa(String.fromCharCode(...new Uint8Array(signRaw)));
  const url = `https://www.okx.com${path}${method==="GET" && query ? `?${query.toString()}` : ""}`;
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

// ================= Handler =================
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: cors(origin) });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 認証
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "no token" }), { status: 401, headers: cors(origin) });
    const token = authz.slice("Bearer ".length);
    const { data: u } = await supabase.auth.getUser(token);
    const userId = u?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "bad token" }), { status: 401, headers: cors(origin) });

    const body = (await req.json()) as Body;
    const exchange = body.exchange;
    if (!["binance","bybit","okx"].includes(exchange)) {
      return new Response(JSON.stringify({ error: "bad exchange" }), { status: 400, headers: cors(origin) });
    }
    const sinceMs = toMs(body.since);
    const untilMs = toMs(body.until);
    const kinds = body.kinds?.length ? body.kinds : ["trades","deposits","withdrawals"];

    // 鍵読み出し
    const { data: credRow } = await supabase
      .from("exchange_api_credentials")
      .select("enc_blob, external_user_id")
      .eq("user_id", userId)
      .eq("exchange", exchange)
      .maybeSingle();
    if (!credRow?.enc_blob) {
      return new Response(JSON.stringify({ error: "no credentials" }), { status: 400, headers: cors(origin) });
    }
    const secretObj = await decryptBlob(credRow.enc_blob);
    const apiKey = secretObj.apiKey as string;
    const apiSecret = secretObj.apiSecret as string;
    const apiPassphrase = (secretObj.apiPassphrase ?? null) as (string|null);
    const extId = credRow.external_user_id ?? null;

    let inserted = 0, errors = 0, total = 0;
    async function save(list: any[]) {
      total += list.length;
      try { await saveTrades(supabase, userId, exchange, extId, list); inserted += list.length; }
      catch { errors += list.length; }
    }

    if (kinds.includes("trades")) {
      if (exchange === "binance") {
        // symbols が null/空欄なら ALL 推定
        let symList: string[] = [];
        if (body.symbols && body.symbols.trim()) {
          symList = body.symbols.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
        } else {
          symList = await resolveBinanceSymbolsAll(apiKey, apiSecret);
        }
        if (symList.length) {
          const list = await fetchBinanceTrades(apiKey, apiSecret, symList, sinceMs, untilMs);
          await save(list);
        }
      } else if (exchange === "bybit") {
        const list = await fetchBybitTrades(apiKey, apiSecret, sinceMs, untilMs);
        await save(list);
      } else if (exchange === "okx") {
        if (!apiPassphrase) throw new Error("okx: api_passphrase missing");
        const list = await fetchOkxTrades(apiKey, apiSecret, apiPassphrase, sinceMs, untilMs);
        await save(list);
      }
    }
    if (kinds.includes("deposits")) {
      if (exchange === "binance")       await save(await fetchBinanceDeposits(apiKey, apiSecret, sinceMs, untilMs));
      else if (exchange === "bybit")    await save(await fetchBybitDeposits(apiKey, apiSecret, sinceMs, untilMs));
      else if (exchange === "okx") {
        if (!apiPassphrase) throw new Error("okx: api_passphrase missing");
        await save(await fetchOkxDeposits(apiKey, apiSecret, apiPassphrase, sinceMs));
      }
    }
    if (kinds.includes("withdrawals")) {
      if (exchange === "binance")       await save(await fetchBinanceWithdraws(apiKey, apiSecret, sinceMs, untilMs));
      else if (exchange === "bybit")    await save(await fetchBybitWithdraws(apiKey, apiSecret, sinceMs, untilMs));
      else if (exchange === "okx") {
        if (!apiPassphrase) throw new Error("okx: api_passphrase missing");
        await save(await fetchOkxWithdraws(apiKey, apiSecret, apiPassphrase, sinceMs));
      }
    }

    return new Response(JSON.stringify({ ok: true, total, inserted, errors }), { status: 200, headers: cors(origin) });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: cors(origin) });
  }
});

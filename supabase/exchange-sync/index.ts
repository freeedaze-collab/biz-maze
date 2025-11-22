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
  const key = await getKey();
  const parts = enc.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("invalid enc_blob format");
  const iv = b64decode(parts[1]);
  const ct = b64decode(parts[2]);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
  const s = Array.from(pt).map((x) => String.fromCharCode(x)).join("");
  return JSON.parse(s);
}

// CORS helper
const cors = (origin: string | null) => ({
  "access-control-allow-origin": origin ?? "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST,OPTIONS",
  "content-type": "application/json",
});

// -------- Binance helpers --------
const BINANCE_ENDPOINT = "https://api.binance.com";

function signBinance(path: string, params: Record<string,any>, secret: string) {
  const usp = new URLSearchParams();
  for (const [k,v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  const qs = usp.toString();
  const data = new TextEncoder().encode(qs);
  const keyBytes = new TextEncoder().encode(secret);
  const cryptoKeyPromise = crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return cryptoKeyPromise.then(key =>
    crypto.subtle.sign("HMAC", key, data).then(signRaw => {
      const sign = btoa(String.fromCharCode(...new Uint8Array(signRaw)));
      const signHex = Array.from(atob(sign)).map(c => c.charCodeAt(0).toString(16).padStart(2,"0")).join("");
      return `${BINANCE_ENDPOINT}${path}?${qs}&signature=${signHex}`;
    })
  );
}

async function fetchBinanceTrades(apiKey: string, apiSecret: string, sinceMs?: number, untilMs?: number) {
  // 注意：Binance の SPOT API を想定
  // GET /api/v3/myTrades
  const endTs = untilMs ?? Date.now();
  const params: Record<string,any> = {
    timestamp: Date.now(),
    recvWindow: 60000,
  };
  if (sinceMs) params.startTime = sinceMs;
  if (endTs) params.endTime = endTs;

  // シンボル指定が必要だが、ここでは代表例として BTCUSDT のみ
  // 実際は symbols リストを呼び出し元から貰うか、事前にメタデータを持っておく必要あり
  // この関数はサンプルとして BTCUSDT 固定
  const symbol = "BTCUSDT";
  params.symbol = symbol;

  const url = await signBinance("/api/v3/myTrades", params, apiSecret);
  const res = await fetch(url, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`binance trades failed: ${res.status} ${txt}`);
  }
  const data = await res.json() as any[];
  return data.map((t) => ({
    exchange: "binance",
    symbol: t.symbol,
    side: t.isBuyer ? "BUY" : "SELL",
    qty: Number(t.qty),
    price: Number(t.price),
    fee: Number(t.commission ?? 0),
    fee_asset: t.commissionAsset ?? null,
    ts: Number(t.time),
    trade_id: String(t.id),
    raw: t,
  }));
}

async function fetchBinanceDeposits(apiKey: string, apiSecret: string, sinceMs?: number, untilMs?: number) {
  // GET /sapi/v1/capital/deposit/hisrec
  const endTs = untilMs ?? Date.now();
  const params: Record<string,any> = {
    timestamp: Date.now(),
    recvWindow: 60000,
  };
  if (sinceMs) params.startTime = sinceMs;
  if (endTs) params.endTime = endTs;

  const usp = new URLSearchParams();
  for (const [k,v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  const qs = usp.toString();
  const data = new TextEncoder().encode(qs);
  const keyBytes = new TextEncoder().encode(apiSecret);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signRaw = await crypto.subtle.sign("HMAC", key, data);
  const sign = btoa(String.fromCharCode(...new Uint8Array(signRaw)));
  const signHex = Array.from(atob(sign)).map(c => c.charCodeAt(0).toString(16).padStart(2,"0")).join("");
  const url = `${BINANCE_ENDPOINT}/sapi/v1/capital/deposit/hisrec?${qs}&signature=${signHex}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`binance deposits failed: ${res.status} ${txt}`);
  }
  const data = await res.json() as any[];
  return data.map((d) => ({
    exchange: "binance",
    symbol: d.coin,
    side: "DEPOSIT",
    qty: Number(d.amount),
    price: null,
    fee: 0,
    fee_asset: d.coin,
    ts: Number(d.insertTime),
    trade_id: `dep_${d.txId ?? d.id ?? d.address ?? d.insertTime}`,
    raw: d,
  }));
}

async function fetchBinanceWithdraws(apiKey: string, apiSecret: string, sinceMs?: number, untilMs?: number) {
  const endTs = untilMs ?? Date.now();
  const params: Record<string,any> = {
    timestamp: Date.now(),
    recvWindow: 60000,
  };
  if (sinceMs) params.startTime = sinceMs;
  if (endTs) params.endTime = endTs;

  const usp = new URLSearchParams();
  for (const [k,v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.append(k, String(v));
  }
  const qs = usp.toString();
  const data = new TextEncoder().encode(qs);
  const keyBytes = new TextEncoder().encode(apiSecret);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signRaw = await crypto.subtle.sign("HMAC", key, data);
  const sign = btoa(String.fromCharCode(...new Uint8Array(signRaw)));
  const signHex = Array.from(atob(sign)).map(c => c.charCodeAt(0).toString(16).padStart(2,"0")).join("");
  const url = `${BINANCE_ENDPOINT}/sapi/v1/capital/withdraw/history?${qs}&signature=${signHex}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`binance withdraws failed: ${res.status} ${txt}`);
  }
  const data = await res.json() as any[];
  return data.map((d) => ({
    exchange: "binance",
    symbol: d.coin,
    side: "WITHDRAW",
    qty: -Number(d.amount),
    price: null,
    fee: Number(d.transactionFee ?? 0),
    fee_asset: d.coin,
    ts: Number(d.applyTime),
    trade_id: `wd_${d.id ?? d.applyTime}`,
    raw: d,
  }));
}

// -------- Bybit helpers --------
const BYBIT_ENDPOINT = "https://api.bybit.com";

async function fetchBybitTrades(apiKey: string, apiSecret: string, sinceMs?: number, untilMs?: number) {
  // これは簡略版サンプル。実際の Bybit v5 API では署名とパラメータがかなり多い。
  // ここではダミー的に "no implementation" を返すための形だけ用意している。
  return [] as any[];
}

async function fetchBybitDeposits(apiKey: string, apiSecret: string, sinceMs?: number, untilMs?: number) {
  return [] as any[];
}

async function fetchBybitWithdraws(apiKey: string, apiSecret: string, sinceMs?: number, untilMs?: number) {
  return [] as any[];
}

// -------- OKX helpers --------
const OKX_ENDPOINT = "https://www.okx.com";

async function fetchOkxTrades(apiKey: string, apiSecret: string, apiPassphrase: string, sinceMs?: number, untilMs?: number) {
  // 本実装は省略。実際には OKX の REST API ( /api/v5/trade/fills など ) を使う。
  return [] as any[];
}

async function fetchOkxDeposits(apiKey: string, apiSecret: string, apiPassphrase: string, sinceMs?: number, untilMs?: number) {
  return [] as any[];
}

async function fetchOkxWithdraws(apiKey: string, apiSecret: string, apiPassphrase: string, sinceMs?: number, untilMs?: number) {
  return [] as any[];
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
      .upsert(payload, {
        onConflict: "user_id,exchange,external_user_id,trade_id",
      });
  }
}

// ---------- メイン ----------

type SyncBody = {
  exchange: "binance" | "bybit" | "okx";
  since?: string | number | null; // ISO or ms
  until?: string | number | null; // ISO or ms
  kinds?: ("spot_trades"|"deposits"|"withdrawals")[];
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: cors(origin) });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "server_misconfigured" }), { status: 500, headers: cors(origin) });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Auth
    const authz = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authz?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "no_token" }), { status: 401, headers: cors(origin) });
    }
    const token = authz.slice("Bearer ".length);
    const { data: u, error: uerr } = await supabase.auth.getUser(token);
    if (uerr) return new Response(JSON.stringify({ error: "auth_error", details: uerr.message }), { status: 401, headers: cors(origin) });
    const userId = u?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "bad_token" }), { status: 401, headers: cors(origin) });

    const body = (await req.json().catch(() => ({}))) as SyncBody;
    const exchange = body.exchange;
    if (!["binance","bybit","okx"].includes(exchange)) {
      return new Response(JSON.stringify({ error: "bad_exchange" }), { status: 400, headers: cors(origin) });
    }

    const kinds = (Array.isArray(body.kinds) && body.kinds.length > 0)
      ? body.kinds
      : ["spot_trades","deposits","withdrawals"];

    const toMs = (v?: number|string|null) => {
      if (v === null || v === undefined) return undefined;
      if (typeof v === "number") return v;
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : undefined;
    };
    const sinceMs = toMs(body.since);
    const untilMs = toMs(body.until);

    // credentials を取得
    const { data: cred, error: cerr } = await supabase
      .from("exchange_api_credentials")
      .select("enc_blob, external_user_id")
      .eq("user_id", userId)
      .eq("exchange", exchange)
      .maybeSingle();

    if (cerr) {
      return new Response(JSON.stringify({ error: "credentials_read_failed", details: cerr.message }), { status: 500, headers: cors(origin) });
    }
    if (!cred) {
      return new Response(JSON.stringify({ error: "no_credentials" }), { status: 400, headers: cors(origin) });
    }

    const decrypted = await decryptBlob(cred.enc_blob);
    const apiKey = decrypted.apiKey as string;
    const apiSecret = decrypted.apiSecret as string;
    const apiPassphrase = decrypted.apiPassphrase as (string | null);
    const external_user_id = cred.external_user_id ?? null;

    if (!apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "invalid_decrypted_credentials" }), { status: 500, headers: cors(origin) });
    }

    let total = 0;
    let inserted = 0;
    const errors: string[] = [];

    async function save(items: any[]) {
      if (!items?.length) return;
      total += items.length;
      try {
        await saveTrades(supabase, userId!, exchange, external_user_id, items);
        inserted += items.length;
      } catch (e: any) {
        errors.push(e?.message ?? String(e));
      }
    }

    if (kinds.includes("spot_trades")) {
      if (exchange === "binance")       await save(await fetchBinanceTrades(apiKey, apiSecret, sinceMs, untilMs));
      else if (exchange === "bybit")    await save(await fetchBybitTrades(apiKey, apiSecret, sinceMs, untilMs));
      else if (exchange === "okx") {
        if (!apiPassphrase) throw new Error("okx: api_passphrase missing");
        await save(await fetchOkxTrades(apiKey, apiSecret, apiPassphrase, sinceMs, untilMs));
      }
    }
    if (kinds.includes("deposits")) {
      if (exchange === "binance")       await save(await fetchBinanceDeposits(apiKey, apiSecret, sinceMs, untilMs));
      else if (exchange === "bybit")    await save(await fetchBybitDeposits(apiKey, apiSecret, sinceMs, untilMs));
      else if (exchange === "okx") {
        if (!apiPassphrase) throw new Error("okx: api_passphrase missing");
        await save(await fetchOkxDeposits(apiKey, apiSecret, apiPassphrase, sinceMs, untilMs));
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

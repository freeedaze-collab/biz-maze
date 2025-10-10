// Supabase Edge Function (Deno): sync-wallet-transactions
// 目的：認証ユーザーのウォレット（public.wallets）を対象に、Polygonの履歴を取得し
//       public.wallet_transactions に正規化 upsert（既存互換のため public.transactions にもtry）
// 既存機能の維持点：Alchemy 取得 / CoinGecko によるUSD評価（rawに格納）/ Polygon優先
// 依存：ALCHEMY_API_KEY, COINGECKO_API_BASE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// 認証：Authorization: Bearer <access_token> 必須（Verify JWTを関数の設定でON推奨）
// 入力：POST JSON で任意指定可：{ walletAddress?: "0x...", since?: "2024-01-01T00:00:00Z", limit?: number }
//       指定がなければ、DB上の自分の wallets 全件を対象（アドレスごとに最新から最大limit件）
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALCHEMY_API_KEY = Deno.env.get('ALCHEMY_API_KEY')!
const COINGECKO_API_BASE = Deno.env.get('COINGECKO_API_BASE') ?? 'https://api.coingecko.com/api/v3'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

if (!ALCHEMY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env(s): ALCHEMY_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const CHAIN_ID_POLYGON = 137
const ALCHEMY_BASE_POLYGON = `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

// Known tokens on Polygon
const WETH_POLYGON = {
  address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  symbol: 'WETH',
  decimals: 18,
}
const NATIVE_MATIC = { symbol: 'MATIC', decimals: 18 }

type Req = {
  walletAddress?: `0x${string}`;
  since?: string;     // ISO
  limit?: number;     // 1 ~ 1000 (default 200)
}

type AlchemyTransfer = {
  hash: string;
  blockNum: string; // hex
  category: 'external'|'internal'|'erc20'|'erc721'|'erc1155';
  from: string;
  to: string;
  value: string | null; // decimal string (native) の可能性あり
  asset?: string | null;
  rawContract?: {
    address?: string | null;
    value?: string | null;       // hex wei or decimal string
    decimal?: string | number | null;
  } | null;
  metadata: { blockTimestamp?: string };
  logIndex?: number | null;
};

type TxInsert = {
  user_id: string;
  address: string;
  chain: string;                // 'ethereum' | 'polygon' 等（ここでは 'polygon' にしても可）
  tx_hash: string;
  log_index: number;
  block_number: number;
  timestamp: string;            // ISO
  direction: 'in' | 'out' | 'self';
  asset: string;                // 'MATIC' | 'WETH' | 'ERC20'
  amount_numeric: number;       // 10^-decimalsスケール済み
  from_addr: string | null;
  to_addr: string | null;
  fee_native: number | null;    // ここでは未知→null
  raw: Record<string, unknown>;
};

function toFixedStr(n: number, digits = 8) {
  return Number.isFinite(n) ? Number(n).toFixed(digits) : '0'
}

function hexToNumber(hex: string): number {
  try {
    return Number(BigInt(hex))
  } catch {
    return 0
  }
}

function normalizeDirection(addr: string, from: string | null | undefined, to: string | null | undefined): 'in'|'out'|'self' {
  const a = addr?.toLowerCase()
  const f = from?.toLowerCase()
  const t = to?.toLowerCase()
  if (f === a && t === a) return 'self'
  if (t === a) return 'in'
  return 'out'
}

// ERC-20などの数量スケール
function scaleRawAmount(raw: string | null | undefined, decimals = 18): number {
  if (!raw) return 0
  try {
    if (raw.startsWith('0x')) {
      const bn = BigInt(raw)
      const base = 10n ** BigInt(decimals)
      const intPart = bn / base
      const fracPart = bn % base
      const s = `${intPart.toString()}.${(fracPart + base).toString().slice(1)}`
      return Number(s)
    }
    // decimal string の場合
    return Number(raw)
  } catch {
    return 0
  }
}

// === CoinGecko helpers ===
async function priceUsdAtTimestampPolygonContract(contract: string, tsISO: string): Promise<number | null> {
  const ts = Math.floor(new Date(tsISO).getTime() / 1000)
  const from = ts - 180
  const to = ts + 180
  const url = `${COINGECKO_API_BASE}/coins/polygon-pos/contract/${contract}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  const prices: [number, number][] = json?.prices ?? []
  if (!prices.length) return null
  const targetMs = Math.floor(new Date(tsISO).getTime())
  let best = prices[0][1], bestDiff = Math.abs(prices[0][0] - targetMs)
  for (const [t, p] of prices) {
    const d = Math.abs(t - targetMs)
    if (d < bestDiff) { bestDiff = d; best = p }
  }
  return Number(best)
}

async function priceUsdAtTimestampMatic(tsISO: string): Promise<number | null> {
  const ts = Math.floor(new Date(tsISO).getTime() / 1000)
  const from = ts - 180
  const to = ts + 180
  // matic-network は古称。CoinGecko 側の変更があればここを差し替え
  const url = `${COINGECKO_API_BASE}/coins/matic-network/market_chart/range?vs_currency=usd&from=${from}&to=${to}`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  const prices: [number, number][] = json?.prices ?? []
  if (!prices.length) return null
  const targetMs = Math.floor(new Date(tsISO).getTime())
  let best = prices[0][1], bestDiff = Math.abs(prices[0][0] - targetMs)
  for (const [t, p] of prices) {
    const d = Math.abs(t - targetMs)
    if (d < bestDiff) { bestDiff = d; best = p }
  }
  return Number(best)
}

async function fetchPolygonTransfers(address: string, maxCountHex = '0x0C8' /* 200件 */) {
  const payload = {
    id: 1,
    jsonrpc: '2.0',
    method: 'alchemy_getAssetTransfers',
    params: [{
      fromBlock: '0x0',
      toBlock: 'latest',
      fromAddress: address,
      toAddress: address,
      category: ['external', 'internal', 'erc20'],
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: maxCountHex,   // 0x0C8 = 200
      order: 'desc',
    }],
  }
  const res = await fetch(ALCHEMY_BASE_POLYGON, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Alchemy error: ${res.status}`)
  const json = await res.json()
  const transfers: AlchemyTransfer[] = json?.result?.transfers ?? []
  return transfers
}

async function upsertWalletTx(row: TxInsert) {
  // 1) 新スキーマ wallet_transactions
  const { error: e1 } = await admin
    .from('wallet_transactions')
    .upsert({
      user_id: row.user_id,
      address: row.address,
      chain: row.chain,
      tx_hash: row.tx_hash,
      log_index: row.log_index,
      block_number: row.block_number,
      timestamp: row.timestamp,
      direction: row.direction,
      asset: row.asset,
      amount_numeric: row.amount_numeric,
      from_addr: row.from_addr,
      to_addr: row.to_addr,
      fee_native: row.fee_native,
      raw: row.raw
    }, { onConflict: 'user_id,tx_hash,log_index' })
  if (!e1) return

  // 2) 既存互換：transactions が残っているプロジェクト用（ベストエフォート）
  //    スキーマ差異があるため、入る項目だけ送る
  await admin
    .from('transactions')
    .upsert({
      user_id: row.user_id,
      chain_id: CHAIN_ID_POLYGON,
      network: 'polygon',
      tx_hash: row.tx_hash,
      log_index: row.log_index,
      timestamp: row.timestamp,
      direction: row.direction,
      from_address: row.from_addr,
      to_address: row.to_addr,
      asset_symbol: row.asset,
      amount: toFixedStr(row.amount_numeric, 8),
      inserted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      raw: row.raw
    }, { onConflict: 'chain_id,tx_hash,log_index' })
  // エラーは握りつぶす（旧テーブルが無い環境を許容）
}

serve(async (req) => {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { 'content-type': 'application/json' }
      })
    }

    const auth = req.headers.get('authorization') || ''
    const token = auth.replace(/^Bearer\s+/i, '')
    if (!token) return new Response(JSON.stringify({ error: 'Missing bearer token' }), { status: 401 })

    // トークンからユーザーを特定
    const { data: userRes, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), { status: 401 })
    }
    const userId = userRes.user.id

    // リクエストオプション
    let body: Req = {}
    if (req.method === 'POST') {
      try { body = await req.json() } catch { body = {} }
    } else {
      const u = new URL(req.url)
      const walletAddress = u.searchParams.get('walletAddress') || undefined
      const since = u.searchParams.get('since') || undefined
      const limit = u.searchParams.get('limit') || undefined
      body = {
        walletAddress: walletAddress as any,
        since,
        limit: limit ? Number(limit) : undefined
      }
    }

    // 対象ウォレットの決定
    let targetAddresses: string[] = []
    if (body.walletAddress) {
      targetAddresses = [body.walletAddress]
    } else {
      const { data: ws, error: werr } = await admin
        .from('wallets')
        .select('address')
        .eq('user_id', userId)
      if (werr) return new Response(JSON.stringify({ error: werr.message }), { status: 400 })
      targetAddresses = (ws ?? []).map((w) => w.address).filter(Boolean)
    }
    if (!targetAddresses.length) {
      return new Response(JSON.stringify({ ok: true, inserted_or_updated: 0, reason: 'no wallets' }), { status: 200 })
    }

    // 範囲・件数
    const sinceISO = body.since && !isNaN(Date.parse(body.since)) ? body.since : undefined
    const limit = Math.min(Math.max(body.limit ?? 200, 1), 1000)
    const maxCountHex = '0x' + limit.toString(16)

    let total = 0

    for (const addr of targetAddresses) {
      // Alchemyから取得
      const transfers = await fetchPolygonTransfers(addr, maxCountHex)

      // since フィルタ（必要な場合）
      const filtered = sinceISO
        ? transfers.filter(t => {
            const ts = t.metadata?.blockTimestamp
            return ts ? new Date(ts) >= new Date(sinceISO) : true
          })
        : transfers

      // 正規化して upsert
      for (const t of filtered) {
        const ts = t.metadata?.blockTimestamp ?? new Date().toISOString()
        const logIndex = t.logIndex ?? 0
        const bn = hexToNumber(t.blockNum)

        let assetSymbol = t.asset ?? ''
        let assetDecimals = Number((t.rawContract?.decimal as number) ?? 18)
        let assetContract = t.rawContract?.address ?? null
        let amount = 0

        if (t.category === 'erc20') {
          const raw = t.rawContract?.value ?? null
          amount = scaleRawAmount(raw, Number.isFinite(assetDecimals) ? assetDecimals : 18)
          if (assetContract?.toLowerCase() === WETH_POLYGON.address.toLowerCase()) {
            assetSymbol = WETH_POLYGON.symbol
            assetDecimals = WETH_POLYGON.decimals
          } else {
            if (!assetSymbol) assetSymbol = 'ERC20'
            if (!Number.isFinite(assetDecimals)) assetDecimals = 18
          }
        } else if (t.category === 'external' || t.category === 'internal') {
          if (t.value) {
            amount = Number(t.value)   // Alchemyのdecimal string
            assetSymbol = NATIVE_MATIC.symbol
            assetDecimals = NATIVE_MATIC.decimals
            assetContract = null
          }
        } else {
          // NFT等は除外
          continue
        }

        const direction = normalizeDirection(addr, t.from, t.to)

        // === USD評価 ===
        let usdAtTx: number | null = null
        let priceSource: string | null = null
        if (assetContract) {
          const px = await priceUsdAtTimestampPolygonContract(assetContract, ts)
          if (px && Number.isFinite(px)) { usdAtTx = px * amount; priceSource = 'coingecko' }
        } else if (assetSymbol === NATIVE_MATIC.symbol) {
          const px = await priceUsdAtTimestampMatic(ts)
          if (px && Number.isFinite(px)) { usdAtTx = px * amount; priceSource = 'coingecko' }
        }

        const row: TxInsert = {
          user_id: userId,
          address: addr,
          chain: 'polygon',
          tx_hash: t.hash,
          log_index: logIndex,
          block_number: bn,
          timestamp: ts,
          direction,
          asset: assetSymbol || (assetContract ? 'ERC20' : NATIVE_MATIC.symbol),
          amount_numeric: Number(toFixedStr(amount, 18)),
          from_addr: t.from ?? null,
          to_addr: t.to ?? null,
          fee_native: null,
          raw: {
            chain_id: CHAIN_ID_POLYGON,
            category: t.category,
            asset_contract: assetContract,
            asset_decimals: assetDecimals,
            price_usd_value: usdAtTx !== null ? Number(toFixedStr(usdAtTx, 8)) : null,
            price_source: priceSource,
            alchemy: t
          }
        }

        await upsertWalletTx(row)
        total++
      }
    }

    return new Response(
      JSON.stringify({ ok: true, inserted_or_updated: total, wallets: targetAddresses.length }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error)?.message ?? 'Internal error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
})

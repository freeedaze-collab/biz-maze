// Supabase Edge Function (Deno): sync-wallet-transactions
// 目的：Polygon上のウォレット履歴を取得し、transactions に正規化 upsert
// 価格付け：WETH(ERC-20) + MATIC(ネイティブ) + 一般ERC-20(契約アドレス) を CoinGecko で USD評価
// 依存：ALCHEMY_API_KEY, COINGECKO_API_BASE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALCHEMY_API_KEY = Deno.env.get('ALCHEMY_API_KEY')!;
const COINGECKO_API_BASE = Deno.env.get('COINGECKO_API_BASE') ?? 'https://api.coingecko.com/api/v3';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Polygon constants
const CHAIN_ID_POLYGON = 137;
const ALCHEMY_BASE_POLYGON = `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Known tokens on Polygon
const WETH_POLYGON = {
  address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  symbol: 'WETH',
  decimals: 18,
};
// Native MATIC is not ERC-20 on Polygon
const NATIVE_MATIC = { symbol: 'MATIC', decimals: 18 };

type Req = {
  userId: string;
  walletAddress: `0x${string}`;
  chainIds: number[];     // e.g., [137]
  since?: string;         // ISO
  cursor?: string | null; // reserved
};

type AlchemyTransfer = {
  hash: string;
  blockNum: string; // hex
  category: 'external'|'internal'|'erc20'|'erc721'|'erc1155';
  from: string;
  to: string;
  value: string | null; // native (MATIC) value as decimal string (Alchemy仕様)
  asset?: string | null;
  rawContract?: {
    address?: string | null;
    value?: string | null;       // hex wei or decimal string
    decimal?: string | number | null;
  } | null;
  metadata: { blockTimestamp?: string };
  logIndex?: number | null;
};

type TxRow = {
  user_id: string;
  chain_id: number;
  network: string;
  tx_hash: string;
  log_index: number;
  timestamp: string; // ISO
  direction: 'in' | 'out' | 'self';
  type: string;
  from_address: string;
  to_address: string;
  asset_contract: string | null;
  asset_symbol: string;
  asset_decimals: number;
  amount: string; // human readable
  fee_native: string | null;
  usd_value_at_tx: string | null;
  usd_fee_at_tx: string | null;
  price_source: string | null;
  inserted_at: string;
  updated_at: string;
};

function toFixedStr(n: number, digits = 8) {
  return Number.isFinite(n) ? n.toFixed(digits) : '0';
}
function normalizeDirection(addr: string, from: string, to: string): 'in' | 'out' | 'self' {
  const a = addr?.toLowerCase();
  if (from?.toLowerCase() === a && to?.toLowerCase() === a) return 'self';
  if (to?.toLowerCase() === a) return 'in';
  return 'out';
}
function scaleRawAmount(raw: string | null | undefined, decimals = 18): number {
  if (!raw) return 0;
  let bn: bigint;
  if (raw.startsWith('0x')) bn = BigInt(raw);
  else bn = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const intPart = bn / base;
  const fracPart = bn % base;
  const s = `${intPart.toString()}.${(fracPart + base).toString().slice(1)}`;
  return Number(s);
}

// === CoinGecko helpers ===
async function priceUsdAtTimestampPolygonContract(contract: string, tsISO: string): Promise<number | null> {
  const from = Math.floor(new Date(tsISO).getTime() / 1000) - 120;
  const to = Math.floor(new Date(tsISO).getTime() / 1000) + 120;
  const url = `${COINGECKO_API_BASE}/coins/polygon-pos/contract/${contract}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const prices: [number, number][] = json?.prices ?? [];
  if (!prices.length) return null;
  const target = Math.floor(new Date(tsISO).getTime());
  let best = prices[0][1], bestDiff = Math.abs(prices[0][0] - target);
  for (const [t, p] of prices) {
    const d = Math.abs(t - target);
    if (d < bestDiff) { bestDiff = d; best = p; }
  }
  return Number(best);
}
async function priceUsdAtTimestampMatic(tsISO: string): Promise<number | null> {
  // CoinGecko coin id for native MATIC
  const from = Math.floor(new Date(tsISO).getTime() / 1000) - 120;
  const to = Math.floor(new Date(tsISO).getTime() / 1000) + 120;
  const url = `${COINGECKO_API_BASE}/coins/matic-network/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const prices: [number, number][] = json?.prices ?? [];
  if (!prices.length) return null;
  const target = Math.floor(new Date(tsISO).getTime());
  let best = prices[0][1], bestDiff = Math.abs(prices[0][0] - target);
  for (const [t, p] of prices) {
    const d = Math.abs(t - target);
    if (d < bestDiff) { bestDiff = d; best = p; }
  }
  return Number(best);
}

async function fetchPolygonTransfers(address: string) {
  const payload = {
    id: 1,
    jsonrpc: '2.0',
    method: 'alchemy_getAssetTransfers',
    params: [{
      fromBlock: '0x0',
      toBlock: 'latest',
      fromAddress: address,
      toAddress: address,
      category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: '0x3e8',
      order: 'desc',
    }],
  };
  const res = await fetch(ALCHEMY_BASE_POLYGON, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Alchemy error: ${res.status}`);
  const json = await res.json();
  const transfers: AlchemyTransfer[] = json?.result?.transfers ?? [];
  return transfers;
}

serve(async (req) => {
  try {
    const { userId, walletAddress, chainIds } = (await req.json()) as Req;

    if (!userId || !walletAddress || !Array.isArray(chainIds) || chainIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
    }

    const includePolygon = chainIds.includes(CHAIN_ID_POLYGON);
    const nowISO = new Date().toISOString();
    const outRows: TxRow[] = [];

    if (includePolygon) {
      const transfers = await fetchPolygonTransfers(walletAddress);

      for (const t of transfers) {
        const ts = t.metadata?.blockTimestamp ?? nowISO;
        const logIndex = t.logIndex ?? 0;

        let assetSymbol = t.asset ?? '';
        let assetDecimals = Number((t.rawContract?.decimal as number) ?? 18);
        let assetContract = t.rawContract?.address ?? null;
        let type = t.category || 'other';
        let amount = 0;

        // 1) ERC-20（WETH含む）
        if (t.category === 'erc20') {
          const raw = t.rawContract?.value ?? null; // hex/decimal
          amount = scaleRawAmount(raw, isFinite(assetDecimals) ? assetDecimals : 18);

          // WETHの正規化（シンボル/小数）
          if (assetContract?.toLowerCase() === WETH_POLYGON.address.toLowerCase()) {
            assetSymbol = WETH_POLYGON.symbol;
            assetDecimals = WETH_POLYGON.decimals;
          } else {
            // 不明なERC-20で assetSymbol が空なら汎用表示
            if (!assetSymbol) assetSymbol = 'ERC20';
            if (!isFinite(assetDecimals)) assetDecimals = 18;
          }
        }
        // 2) ネイティブ（MATIC）
        else if (t.category === 'external' || t.category === 'internal') {
          if (t.value) {
            amount = Number(t.value); // Alchemyはdecimal文字列を返すことがある
            assetSymbol = NATIVE_MATIC.symbol;
            assetDecimals = NATIVE_MATIC.decimals;
            assetContract = null;
          }
        } else {
          // NFTなどは除外（必要なら拡張）
          continue;
        }

        const direction = normalizeDirection(walletAddress, t.from, t.to);

        // === USD評価 ===
        let usdAtTx: string | null = null;
        if (assetContract) {
          // ERC-20（WETH含む）：コントラクトで価格取得
          const px = await priceUsdAtTimestampPolygonContract(assetContract, ts);
          if (px && isFinite(px)) usdAtTx = toFixedStr(px * amount, 2);
        } else if (assetSymbol === NATIVE_MATIC.symbol) {
          // ネイティブMATIC
          const px = await priceUsdAtTimestampMatic(ts);
          if (px && isFinite(px)) usdAtTx = toFixedStr(px * amount, 2);
        }

        const row: TxRow = {
          user_id: userId,
          chain_id: CHAIN_ID_POLYGON,
          network: 'polygon',
          tx_hash: t.hash,
          log_index: logIndex,
          timestamp: ts,
          direction,
          type,
          from_address: t.from,
          to_address: t.to,
          asset_contract: assetContract,
          asset_symbol: assetSymbol || (assetContract ? 'ERC20' : NATIVE_MATIC.symbol),
          asset_decimals: isFinite(assetDecimals) ? assetDecimals : 18,
          amount: toFixedStr(amount, 8),
          fee_native: null, // TODO: 必要に応じてreceiptから取得
          usd_value_at_tx: usdAtTx,
          usd_fee_at_tx: null,
          price_source: usdAtTx ? 'coingecko' : null,
          inserted_at: nowISO,
          updated_at: nowISO,
        };

        outRows.push(row);
      }

      if (outRows.length) {
        const { error } = await supabase
          .from('transactions')
          .upsert(outRows, { onConflict: 'chain_id,tx_hash,log_index' });
        if (error) throw error;
      }
    }

    return new Response(
      JSON.stringify({ inserted_or_updated: outRows.length, chainIds }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error)?.message ?? 'Internal error' }),
      { status: 500 }
    );
  }
});

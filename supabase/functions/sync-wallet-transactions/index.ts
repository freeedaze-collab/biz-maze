// Supabase Edge Function (Deno): sync-wallet-transactions
// 目的：Polygon上のウォレット履歴（特に WETH / ERC-20）を取得し、transactions に正規化 upsert
// 依存：ALCHEMY_API_KEY, COINGECKO_API_BASE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALCHEMY_API_KEY = Deno.env.get('ALCHEMY_API_KEY')!;
const COINGECKO_API_BASE = Deno.env.get('COINGECKO_API_BASE') ?? 'https://api.coingecko.com/api/v3';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Polygon chain constants
const CHAIN_ID_POLYGON = 137;
const ALCHEMY_BASE_POLYGON = `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// WETH(Polygon) 定義（ERC-20, 18桁）
const WETH_POLYGON = {
  address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  symbol: 'WETH',
  decimals: 18,
};

type Req = {
  userId: string;
  walletAddress: `0x${string}`;
  chainIds: number[];     // 例: [137]
  since?: string;         // ISO string
  cursor?: string | null; // 未来拡張用
};

type AlchemyTransfer = {
  hash: string;
  blockNum: string; // hex
  category: string; // 'external'|'internal'|'erc20'|'erc721'|'erc1155'
  from: string;
  to: string;
  value: string | null; // native (MATIC) の値（単位は ETH系, 文字列)
  asset?: string | null;  // シンボル（例: 'MATIC','WETH'）
  rawContract?: {
    address?: string | null;
    value?: string | null;       // hex wei
    decimal?: string | number | null; // 18 など
  } | null;
  metadata: {
    blockTimestamp?: string; // ISO
  };
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

async function fetchPolygonTransfers(address: string, fromBlock?: string) {
  // Alchemy: getAssetTransfers
  // https://docs.alchemy.com/reference/get-asset-transfers
  const payload = {
    id: 1,
    jsonrpc: '2.0',
    method: 'alchemy_getAssetTransfers',
    params: [{
      fromBlock: fromBlock ?? '0x0',
      toBlock: 'latest',
      fromAddress: address,
      toAddress: address,
      category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: '0x3e8', // up to 1000
      order: 'desc',
    }],
  };

  const res = await fetch(`${ALCHEMY_BASE_POLYGON}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Alchemy error: ${res.status}`);
  const json = await res.json();
  const transfers: AlchemyTransfer[] = json?.result?.transfers ?? [];
  return transfers;
}

function normalizeDirection(addr: string, from: string, to: string): 'in' | 'out' | 'self' {
  const a = addr.toLowerCase();
  if (from?.toLowerCase() === a && to?.toLowerCase() === a) return 'self';
  if (to?.toLowerCase() === a) return 'in';
  return 'out';
}

function hexToInt(hex: string | null | undefined, fallback = 0): number {
  if (!hex) return fallback;
  try { return parseInt(hex, 16); } catch { return fallback; }
}

function scaleRawAmount(raw: string | null | undefined, decimals = 18): number {
  if (!raw) return 0;
  // raw は 10進数文字列 or hex（AlchemyのrawContract.valueはhex）
  let bn: bigint;
  if (raw.startsWith('0x')) {
    bn = BigInt(raw);
  } else {
    // 10進数文字列
    bn = BigInt(raw);
  }
  const base = 10n ** BigInt(decimals);
  // 小数にする
  const intPart = bn / base;
  const fracPart = bn % base;
  const fracStr = (fracPart + base).toString().slice(1).padStart(Number(decimals), '0');
  const s = `${intPart.toString()}.${fracStr}`;
  return Number(s);
}

async function priceUsdAtTimestampWETH(tsISO: string): Promise<number | null> {
  // CoinGecko: market_chart/range for Polygon PoS WETH contract
  // GET /coins/polygon-pos/contract/{contract}/market_chart/range?vs_currency=usd&from=UNIX&to=UNIX
  const from = Math.floor(new Date(tsISO).getTime() / 1000) - 120; // -2min buffer
  const to = Math.floor(new Date(tsISO).getTime() / 1000) + 120;   // +2min buffer
  const url = `${COINGECKO_API_BASE}/coins/polygon-pos/contract/${WETH_POLYGON.address}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const prices: [number, number][] = json?.prices ?? [];
  if (!prices.length) return null;
  // いちばん近い価格を拾う
  const target = Math.floor(new Date(tsISO).getTime());
  let best = prices[0][1];
  let bestDiff = Math.abs(prices[0][0] - target);
  for (const [t, p] of prices) {
    const d = Math.abs(t - target);
    if (d < bestDiff) { bestDiff = d; best = p; }
  }
  return Number(best);
}

serve(async (req) => {
  try {
    const { userId, walletAddress, chainIds } = (await req.json()) as Req;

    if (!userId || !walletAddress || !Array.isArray(chainIds) || chainIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
    }

    // Polygonのみ対象（他チェーンは今は無視）
    const includePolygon = chainIds.includes(CHAIN_ID_POLYGON);
    const nowISO = new Date().toISOString();

    const outRows: TxRow[] = [];

    if (includePolygon) {
      // 送受信両方を取得（Alchemyの仕様に合わせ fromAddress & toAddress 両取り）
      const transfers = await fetchPolygonTransfers(walletAddress);

      for (const t of transfers) {
        const ts = t.metadata?.blockTimestamp ?? nowISO;
        const logIndex = t.logIndex ?? 0;

        // 初期値
        let assetSymbol = t.asset ?? '';
        let assetDecimals = Number((t.rawContract?.decimal as number) ?? 18);
        let assetContract = t.rawContract?.address ?? null;
        let type = t.category || 'other';
        let amount = 0;

        // ERC-20 (特にWETH)を優先的に処理
        if (t.category === 'erc20') {
          // rawContract.value は hex wei のことがある
          const raw = t.rawContract?.value ?? null;
          amount = scaleRawAmount(raw, isFinite(assetDecimals) ? assetDecimals : 18);
          if (assetContract?.toLowerCase() === WETH_POLYGON.address.toLowerCase()) {
            assetSymbol = WETH_POLYGON.symbol;
            assetDecimals = WETH_POLYGON.decimals;
          }
        } else if (t.category === 'external' || t.category === 'internal') {
          // ネイティブ（MATIC）送金は一旦スキップ or 金額だけ取り、シンボル'MATIC'とする
          if (t.value) {
            // t.value は 10進のMATIC量（小数）で返る場合あり（Alchemy形式による）
            amount = Number(t.value);
            assetSymbol = 'MATIC';
            assetDecimals = 18;
            assetContract = null;
          }
        } else {
          // erc721/1155 は会計対象外にする（必要なら拡張）
          continue;
        }

        const direction = normalizeDirection(walletAddress, t.from, t.to);

        // USD換算（WETHのみ対応。その他は null）
        let usdAtTx: string | null = null;
        if (assetContract && assetContract.toLowerCase() === WETH_POLYGON.address.toLowerCase()) {
          const px = await priceUsdAtTimestampWETH(ts);
          if (px && isFinite(px)) {
            usdAtTx = toFixedStr(px * amount, 2);
          }
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
          asset_symbol: assetSymbol || (assetContract ? 'ERC20' : 'MATIC'),
          asset_decimals: isFinite(assetDecimals) ? assetDecimals : 18,
          amount: toFixedStr(amount, 8),
          fee_native: null, // TODO: 必要なら receipt から取得
          usd_value_at_tx: usdAtTx,
          usd_fee_at_tx: null,
          price_source: usdAtTx ? 'coingecko' : null,
          inserted_at: nowISO,
          updated_at: nowISO,
        };

        outRows.push(row);
      }

      // idempotent upsert
      if (outRows.length) {
        const { error } = await supabase
          .from('transactions')
          .upsert(outRows, { onConflict: 'chain_id,tx_hash,log_index' });
        if (error) throw error;
      }
    }

    return new Response(JSON.stringify({
      inserted_or_updated: outRows.length,
      chainIds,
    }), { status: 200 });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error)?.message ?? 'Internal error' }),
      { status: 500 },
    );
  }
});

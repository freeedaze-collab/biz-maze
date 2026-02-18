// supabase/functions/update-prices/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Full Mapping for common and identified special assets in this workspace
const SYMBOL_TO_LLAMA: Record<string, string> = {
  'ETH': 'coingecko:ethereum',
  'BTC': 'coingecko:bitcoin',
  'USDC': 'coingecko:usd-coin',
  'USDT': 'coingecko:tether',
  'DAI': 'coingecko:dai',
  'GTC': 'coingecko:gitcoin',
  'SOL': 'coingecko:solana',
  'BNB': 'coingecko:binancecoin',
  'MATIC': 'coingecko:matic-network',
  'AVAX': 'coingecko:avalanche-2',
  'ARB': 'coingecko:arbitrum',
  'OP': 'coingecko:optimism',
  'SAFE': 'coingecko:safe',
  'WETH': 'coingecko:ethereum',
  'WBTC': 'coingecko:wrapped-bitcoin',
  'GRG': 'coingecko:rigoblock',
  'MTV': 'coingecko:multivac',
  'STETH': 'coingecko:lido-staked-ether',
  'UNI': 'coingecko:uniswap',
  'LINK': 'coingecko:chainlink',
  'AAVE': 'coingecko:aave',
  // Specific assets identified in v_holdings
  'ESTHER': 'ethereum:0xceed9e4f245c71784940f8280658428385731767', // Verified
  'SPARK': 'ethereum:0xeb67a99f18b3ef77ef157208d01150c268f760da', // Verified
  'STEAK': 'ethereum:0x221370211a140f8e123d73aa8e72ef864e3be687', // Verified
  'SMEGMA': 'ethereum:0x56b914aa2c208f287761ca8de5d66d337f5336239ae77be3dc1fe95bd2629d77', // Verified from logs
  'PEIPEIEW': 'ethereum:0x28485feb42e35bfd89667606b5da834f27dc3f94e2cd80ff83d9ac0e03e64d28',
  'SLOINK': 'ethereum:0x5f45ddbbed545f44906558fff5f8d00ad777b088fd57d9a4ce37330b55635fff',
  'JUNFOX': 'ethereum:0x7a48293347a552eb2a8846a8924fd94491e4fdf5a3bdf52493ac3ea86521ac73',
  'PORKWIFHAT': 'ethereum:0xca62f483259e841134f970f7890f7284df052f63c7244b',
  'TSLA': 'ethereum:0x21c0ad19a74426543ed995cc334e7ef1ac0fcb44adb65f7e08d6f5fac', // TSLA on-chain token
}

const CHAIN_PREFIX: Record<string, string> = {
  'eth': 'ethereum', '1': 'ethereum',
  'bsc': 'bsc', '56': 'bsc',
  'polygon': 'polygon', '137': 'polygon',
  'arbitrum': 'arbitrum', '42161': 'arbitrum',
  'base': 'base', '8453': 'base',
}

function normalizeSymbol(s: string): string {
  if (!s) return '';
  const t = s.trim().toUpperCase();
  if (/^[U𝐔][SЅ][D𝐃][CС]$|USDС|UЅDC|𝐔𝐒𝐃𝐂|UЅDС/.test(t)) return 'USDC';
  if (/^[E𝐄][TＴ][HＨ]$|ЕTH|ÈTH/.test(t)) return 'ETH';
  if (/^[BＢ][ＴT][CＣ]$|ВTC/.test(t)) return 'BTC';
  if (/^[D𝐃][A𝐀][IＩ]$/.test(t)) return 'DAI';
  if (/^[U𝐔][SЅ][D𝐃][TＴ]$/.test(t)) return 'USDT';
  return t;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const assetToLlamaId = new Map<string, string>()

    // Discovery: Scan all unique assets from both v_holdings and raw transaction tables
    const symbolsToPrice = new Set<string>()

    // Sources:
    // 1. Current holdings
    const { data: holdings } = await supabase.from('v_holdings').select('asset')
    holdings?.forEach(row => {
      const s = normalizeSymbol(row.asset)
      if (s) symbolsToPrice.add(s)
    })

    // 2. Wallet transactions history (to catch new assets not yet in holdings)
    const { data: walletTxAssets } = await supabase.from('wallet_transactions').select('asset').limit(2000)
    walletTxAssets?.forEach(row => {
      const s = normalizeSymbol(row.asset)
      if (s) symbolsToPrice.add(s)
    })

    // 3. Exchange trades history
    const { data: exchangeTrades } = await supabase.from('exchange_trades').select('symbol').limit(2000)
    exchangeTrades?.forEach(row => {
      // row.symbol is often BASE/QUOTE
      if (row.symbol?.includes('/')) {
        const parts = row.symbol.split('/')
        parts.forEach(p => {
          const s = normalizeSymbol(p)
          if (s) symbolsToPrice.add(s)
        })
      } else {
        const s = normalizeSymbol(row.symbol)
        if (s) symbolsToPrice.add(s)
      }
    })

    // Map discovered symbols to Llama IDs
    for (const symbol of symbolsToPrice) {
      if (SYMBOL_TO_LLAMA[symbol]) {
        assetToLlamaId.set(symbol, SYMBOL_TO_LLAMA[symbol])
      } else if (symbol === 'JPY') {
        // Special case for JPY: we use Tether/JPY as a proxy or just keep it at a fixed baseline if needed
        // but typically daily_exchange_rates handles this. For asset_prices, we can map to a known JPY-pegged coin if exists.
      }
    }

    if (assetToLlamaId.size === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No assets found.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Batch Fetch
    const llamaIds = Array.from(assetToLlamaId.values())
    const res = await fetch(`https://coins.llama.fi/prices/current/${llamaIds.join(',')}`)
    const allPrices: Record<string, number> = {}

    if (res.ok) {
      const data = await res.json()
      const coins = data.coins || {}
      for (const [key, info] of Object.entries(coins) as [string, any][]) {
        if (info?.price) allPrices[key.toLowerCase()] = info.price
      }
    }

    // Upsert
    const pricesToUpsert = []
    for (const [symbol, llamaId] of assetToLlamaId.entries()) {
      const price = allPrices[llamaId.toLowerCase()]
      if (price) {
        pricesToUpsert.push({ asset: symbol, current_price: price, last_updated: new Date().toISOString() })
      }
    }

    if (pricesToUpsert.length > 0) {
      await supabase.from('asset_prices').upsert(pricesToUpsert, { onConflict: 'asset' })
    }

    return new Response(JSON.stringify({
      success: true,
      discovered: assetToLlamaId.size,
      priced: pricesToUpsert.length,
      updates: pricesToUpsert.map(p => `${p.asset}: $${p.current_price.toFixed(4)}`)
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})

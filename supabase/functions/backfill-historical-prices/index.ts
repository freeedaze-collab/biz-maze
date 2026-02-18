// supabase/functions/backfill-historical-prices/index.ts
// Backfills USD value for BOTH wallet_transactions and exchange_trades.
// Uses DefiLlama historical API. Designed to handle ANY wallet size.
//
// Key design decisions for robustness:
// 1. Timestamps are rounded to nearest HOUR — so transactions within the same hour
//    share a single API call (price difference within an hour is negligible for this use case)
// 2. All tokens with a contract address get a DefiLlama ID automatically (chain:address)
// 3. No artificial limits — processes ALL unpriced transactions
// 4. Self-healing: if called multiple times, picks up where it left off
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const CHAIN_PREFIX: Record<string, string> = {
    'eth': 'ethereum', 'bsc': 'bsc', 'polygon': 'polygon',
    'arbitrum': 'arbitrum', 'optimism': 'optimism', 'avalanche': 'avax',
    'base': 'base', 'fantom': 'fantom',
}

const NATIVE_MAP: Record<string, string> = {
    'ETH': 'coingecko:ethereum', 'BNB': 'coingecko:binancecoin',
    'MATIC': 'coingecko:matic-network', 'AVAX': 'coingecko:avalanche-2',
    'FTM': 'coingecko:fantom',
}

// Comprehensive symbol → CoinGecko ID mapping
// This covers ALL tokens that don't have a contract address stored
const SYMBOL_MAP: Record<string, string> = {
    'BTC': 'bitcoin', 'WBTC': 'wrapped-bitcoin', 'ETH': 'ethereum', 'WETH': 'weth',
    'STETH': 'lido-staked-ether', 'GTC': 'gitcoin', 'USDC': 'usd-coin', 'DAI': 'dai',
    'SAFE': 'safe', 'BNB': 'binancecoin', 'MATIC': 'matic-network', 'AVAX': 'avalanche-2',
    'FTM': 'fantom', 'USDT': 'tether', 'SOL': 'solana', 'ARB': 'arbitrum', 'OP': 'optimism',
    'LINK': 'chainlink', 'UNI': 'uniswap', 'AAVE': 'aave', 'GRG': 'rigoblock',
    'DOGE': 'dogecoin', 'SHIB': 'shiba-inu', 'ADA': 'cardano', 'DOT': 'polkadot',
    'XRP': 'ripple', 'ATOM': 'cosmos', 'NEAR': 'near', 'APT': 'aptos',
    'SUI': 'sui', 'SEI': 'sei-network', 'TIA': 'celestia', 'INJ': 'injective-protocol',
    'PEPE': 'pepe', 'WLD': 'worldcoin-wld', 'MKR': 'maker', 'CRV': 'curve-dao-token',
    'LDO': 'lido-dao', 'SNX': 'havven', 'COMP': 'compound-governance-token',
    'SUSHI': 'sushi', '1INCH': '1inch', 'ENS': 'ethereum-name-service',
    'RPL': 'rocket-pool', 'BLUR': 'blur', 'MTV': 'multivac',
}

function getLlamaIds(symbol: string, tokenAddress?: string | null, chain?: string | null): string[] {
    const sym = (symbol || '').toUpperCase().trim()
    if (!sym || sym.length > 10 || /[^A-Z0-9]/.test(sym)) return []

    const ids: string[] = []

    // Native token
    if (tokenAddress === 'native' && NATIVE_MAP[sym]) ids.push(NATIVE_MAP[sym])

    // ERC20 contract address
    if (tokenAddress && tokenAddress !== 'native' && chain) {
        const prefix = CHAIN_PREFIX[chain]
        if (prefix) ids.push(`${prefix}:${tokenAddress}`)
    }

    // CoinGecko symbol fallback (always add if available, so it acts as backup)
    if (SYMBOL_MAP[sym]) {
        const cgId = `coingecko:${SYMBOL_MAP[sym]}`
        if (!ids.includes(cgId)) ids.push(cgId)
    }

    return ids
}


// Round to nearest hour so transactions within the same hour share one API call
function roundToHour(unixTs: number): number {
    return Math.floor(unixTs / 3600) * 3600
}

async function fetchPricesForTimestamp(ts: number, llamaIds: string[]): Promise<Record<string, number>> {
    const url = `https://coins.llama.fi/prices/historical/${ts}/${llamaIds.join(',')}`
    try {
        const res = await fetch(url)
        if (!res.ok) {
            console.warn(`[BACKFILL] DefiLlama ${res.status} for ts=${ts}`)
            return {}
        }
        const data = await res.json()
        const coins = data.coins || {}
        const result: Record<string, number> = {}
        for (const [k, v] of Object.entries(coins) as [string, any][]) {
            if (v?.price && v.price > 0) result[k.toLowerCase()] = v.price
        }
        return result
    } catch (e: any) {
        console.error(`[BACKFILL] Fetch error ts=${ts}:`, e.message)
        return {}
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        let totalWalletUpdated = 0
        let totalExchangeUpdated = 0
        let skippedNoMapping = 0

        // =========================================
        // Part A: Wallet Transactions
        // =========================================
        // Paginate to get ALL unpriced (not just first 500)
        let walletOffset = 0
        const PAGE_SIZE = 1000
        let allWalletBacklog: any[] = []

        while (true) {
            const { data: page } = await supabase
                .from('wallet_transactions')
                .select('id, asset, timestamp, token_address, chain')
                .is('historical_price_unit', null)
                .order('timestamp', { ascending: false })
                .range(walletOffset, walletOffset + PAGE_SIZE - 1)

            if (!page || page.length === 0) break
            allWalletBacklog = allWalletBacklog.concat(page)
            if (page.length < PAGE_SIZE) break
            walletOffset += PAGE_SIZE
        }

        if (allWalletBacklog.length > 0) {
            console.log(`[BACKFILL] Wallet: ${allWalletBacklog.length} txs to price`)

            // Group by HOURLY timestamp → set of DefiLlama IDs
            const hourMap = new Map<number, Set<string>>()
            const hourIdToRecords = new Map<string, string[]>()

            for (const tx of allWalletBacklog) {
                const llamaIds = getLlamaIds(tx.asset, tx.token_address, tx.chain)
                if (llamaIds.length === 0) {
                    skippedNoMapping++
                    continue
                }
                const rawTs = Math.floor(new Date(tx.timestamp).getTime() / 1000)
                const hourTs = roundToHour(rawTs)

                if (!hourMap.has(hourTs)) hourMap.set(hourTs, new Set())
                // Add ALL possible IDs so DefiLlama can match any of them
                for (const llamaId of llamaIds) {
                    hourMap.get(hourTs)!.add(llamaId)
                    const key = `${hourTs}|${llamaId}`
                    if (!hourIdToRecords.has(key)) hourIdToRecords.set(key, [])
                    hourIdToRecords.get(key)!.push(tx.id)
                }
            }

            const uniqueHours = Array.from(hourMap.keys()).sort().reverse()
            console.log(`[BACKFILL] Wallet: ${uniqueHours.length} unique hours to query`)

            for (const hourTs of uniqueHours) {
                const ids = Array.from(hourMap.get(hourTs)!)
                const prices = await fetchPricesForTimestamp(hourTs, ids)

                const updates: { id: string; price: number }[] = []
                for (const lId of ids) {
                    const p = prices[lId.toLowerCase()]
                    if (p) {
                        for (const rid of (hourIdToRecords.get(`${hourTs}|${lId}`) || [])) {
                            updates.push({ id: rid, price: p })
                        }
                    }
                }

                if (updates.length > 0) {
                    const { error } = await supabase.rpc('update_wallet_transaction_prices', { updates })
                    if (!error) totalWalletUpdated += updates.length
                    else console.error(`[BACKFILL] Wallet RPC error:`, error.message)
                }
                await new Promise(r => setTimeout(r, 80))
            }
        }

        // =========================================
        // Part B: Exchange Trades
        // =========================================
        let exchangeOffset = 0
        let allExchangeBacklog: any[] = []

        while (true) {
            const { data: page } = await supabase
                .from('exchange_trades')
                .select('trade_id, symbol, amount, price, ts')
                .is('value_usd', null)
                .order('ts', { ascending: false })
                .range(exchangeOffset, exchangeOffset + PAGE_SIZE - 1)

            if (!page || page.length === 0) break
            allExchangeBacklog = allExchangeBacklog.concat(page)
            if (page.length < PAGE_SIZE) break
            exchangeOffset += PAGE_SIZE
        }

        if (allExchangeBacklog.length > 0) {
            console.log(`[BACKFILL] Exchange: ${allExchangeBacklog.length} trades to price`)

            const eMap = new Map<number, Set<string>>()
            const eIdMap = new Map<string, { trade_id: string; amount: number }[]>()

            for (const trade of allExchangeBacklog) {
                const baseAsset = (trade.symbol || '').split('/')[0].toUpperCase().trim()
                const llamaIds = getLlamaIds(baseAsset)
                if (llamaIds.length === 0) {
                    skippedNoMapping++
                    continue
                }

                const rawTs = Math.floor(new Date(trade.ts).getTime() / 1000)
                const hourTs = roundToHour(rawTs)

                if (!eMap.has(hourTs)) eMap.set(hourTs, new Set())
                for (const llamaId of llamaIds) {
                    eMap.get(hourTs)!.add(llamaId)
                    const key = `${hourTs}|${llamaId}`
                    if (!eIdMap.has(key)) eIdMap.set(key, [])
                    eIdMap.get(key)!.push({ trade_id: trade.trade_id, amount: trade.amount })
                }
            }

            const eHours = Array.from(eMap.keys()).sort().reverse()
            console.log(`[BACKFILL] Exchange: ${eHours.length} unique hours to query`)

            for (const hourTs of eHours) {
                const ids = Array.from(eMap.get(hourTs)!)
                const prices = await fetchPricesForTimestamp(hourTs, ids)

                for (const lId of ids) {
                    const usdPrice = prices[lId.toLowerCase()]
                    if (!usdPrice) continue

                    const trades = eIdMap.get(`${hourTs}|${lId}`) || []
                    for (const t of trades) {
                        const valueUsd = Math.abs(t.amount * usdPrice)
                        const { error } = await supabase
                            .from('exchange_trades')
                            .update({ value_usd: valueUsd })
                            .eq('trade_id', t.trade_id)

                        if (!error) totalExchangeUpdated++
                        else console.error(`[BACKFILL] Exchange error:`, error.message)
                    }
                }
                await new Promise(r => setTimeout(r, 80))
            }
        }

        console.log(`[BACKFILL] Done: wallet=${totalWalletUpdated}, exchange=${totalExchangeUpdated}, skipped=${skippedNoMapping}`)

        return new Response(JSON.stringify({
            success: true,
            wallet_updated: totalWalletUpdated,
            exchange_updated: totalExchangeUpdated,
            skipped_no_mapping: skippedNoMapping,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (e: any) {
        console.error('[BACKFILL] Error:', e)
        return new Response(JSON.stringify({ error: e.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})

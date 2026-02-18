// supabase/functions/sync-wallet-transactions/index.ts
// Unified Multi-Chain Wallet Transaction Sync (EVM, BTC, Solana)
// Supports: Incremental Paginated Sync (from Frontend) AND Full Sync (from Backend)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Connection, PublicKey } from 'https://esm.sh/@solana/web3.js@1.87.6'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Chain configuration
const CHAINS: Record<string, {
    chainId: string
    name: string
    symbol: string
    label: string
    apiBase: string
    chainIdParam?: string  // for Etherscan V2
    requiresKey: boolean
    skip?: boolean
}> = {
    '0x1': {
        chainId: '1', name: 'eth', symbol: 'ETH', label: 'Ethereum',
        apiBase: 'https://api.etherscan.io/v2/api', chainIdParam: '1', requiresKey: true
    },
    '0x38': {
        chainId: '56', name: 'bsc', symbol: 'BNB', label: 'BNB Chain',
        apiBase: 'https://api.etherscan.io/v2/api', chainIdParam: '56', requiresKey: true,
    },
    '0x89': {
        chainId: '137', name: 'polygon', symbol: 'MATIC', label: 'Polygon',
        apiBase: 'https://api.etherscan.io/v2/api', chainIdParam: '137', requiresKey: true,
    },
    '0xa4b1': {
        chainId: '42161', name: 'arbitrum', symbol: 'ETH', label: 'Arbitrum',
        apiBase: 'https://api.routescan.io/v2/network/mainnet/evm/42161/etherscan/api', requiresKey: false
    },
    '0x2105': {
        chainId: '8453', name: 'base', symbol: 'ETH', label: 'Base',
        apiBase: 'https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api', requiresKey: false
    },
    '0xa': {
        chainId: '10', name: 'optimism', symbol: 'ETH', label: 'Optimism',
        apiBase: 'https://api.routescan.io/v2/network/mainnet/evm/10/etherscan/api', requiresKey: false
    },
    '0xa86a': {
        chainId: '43114', name: 'avalanche', symbol: 'AVAX', label: 'Avalanche',
        apiBase: 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api', requiresKey: false
    },
    '0xfa': {
        chainId: '250', name: 'fantom', symbol: 'FTM', label: 'Fantom',
        apiBase: 'https://api.routescan.io/v2/network/mainnet/evm/250/etherscan/api', requiresKey: false
    },
}

function detectAddressType(address: string): 'evm' | 'bitcoin' | 'solana' | 'unknown' {
    const trimmed = address.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return 'evm';
    if (/^(bc1|1|3|tb1|m|n|2)[a-zA-HJ-NP-Z0-9]{25,}$/.test(trimmed)) return 'bitcoin';
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return 'solana';
    return 'unknown';
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing authorization header')

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const etherscanApiKey = Deno.env.get('ETHERSCAN_API_KEY') ?? ''
        const solanaRpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com'

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const body = await req.json().catch(() => ({}))
        const { walletAddress, chainId, nativePage, erc20Page, userId: userIdFromBody } = body

        let userId: string | null = null
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabase.auth.getUser(token)

        if (user) {
            userId = user.id
        } else if (userIdFromBody) {
            userId = userIdFromBody
        }

        if (!userId) throw new Error('Unauthorized')
        if (!walletAddress) throw new Error('walletAddress is required')

        const addressType = detectAddressType(walletAddress)
        console.log(`[SYNC] Address: ${walletAddress}, Detected Type: ${addressType}`)

        if (addressType === 'unknown') {
            throw new Error(`Invalid address format: ${walletAddress}`)
        }

        // 1. Handle BTC / Solana (Non-Paginated for now, or unified)
        if (addressType === 'bitcoin') {
            const txs = await fetchBitcoinTransactions(walletAddress)
            const inserted = await saveTransactions(txs.map(tx => transformBitcoinTx(tx, walletAddress, userId!)), supabase)
            return new Response(JSON.stringify({ success: true, totalInserted: inserted, chains: [{ chain: 'BTC', inserted }] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (addressType === 'solana') {
            const txs = await fetchSolanaTransactions(walletAddress, solanaRpcUrl)
            const inserted = await saveTransactions(txs.map(tx => transformSolanaTx(tx, walletAddress, userId!)), supabase)
            return new Response(JSON.stringify({ success: true, totalInserted: inserted, chains: [{ chain: 'Solana', inserted }] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Handle EVM (Optionally Paginated)
        if (addressType === 'evm') {
            const isIncremental = nativePage !== undefined || erc20Page !== undefined

            if (isIncremental) {
                // Paginated Sync (Called by incrementalWalletSync.ts)
                if (!chainId) throw new Error('chainId is required for incremental sync')
                const chain = CHAINS[chainId]
                if (!chain) throw new Error(`Unsupported chainId: ${chainId}`)

                const result = await syncEvmChainPaginated(chain, walletAddress, userId!, etherscanApiKey, supabase, nativePage || 1, erc20Page || 1)
                return new Response(JSON.stringify({ success: true, ...result }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            } else {
                // Full Sync (Called by sync-all-user-data or legacy buttons)
                let totalInserted = 0
                const chainResults: any[] = []
                const chainsToSync = chainId ? [CHAINS[chainId]].filter(Boolean) : Object.values(CHAINS)

                for (const chain of chainsToSync) {
                    if (chain.requiresKey && !etherscanApiKey) continue
                    try {
                        const inserted = await syncEvmChainFull(chain, walletAddress, userId!, etherscanApiKey, supabase)
                        totalInserted += inserted
                        chainResults.push({ chain: chain.name, status: 'success', inserted })
                    } catch (e: any) {
                        console.error(`[SYNC] Chain ${chain.name} failed:`, e.message)
                        chainResults.push({ chain: chain.name, status: 'failed', error: e.message })
                    }
                }
                return new Response(JSON.stringify({ success: true, totalInserted, chains: chainResults }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
        }

        throw new Error('Unsupported sync requested')
    } catch (e: any) {
        console.error('[SYNC CRITICAL ERROR]', e.message, e.stack)
        return new Response(JSON.stringify({ error: e.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
        })
    }
})

// --- EVM PAGINATED SYNC ---
async function syncEvmChainPaginated(chain: any, walletAddress: string, userId: string, apiKey: string, supabase: any, nativePage: number, erc20Page: number) {
    const PAGE_SIZE = 100
    const walletLower = walletAddress.toLowerCase()

    let nativeInserted = 0
    let erc20Inserted = 0
    let nativeHasMore = false
    let erc20HasMore = false

    // Fetch Native Tx page
    if (nativePage < 999999) {
        const url = buildUrl(chain, 'account', 'txlist', walletAddress, nativePage, PAGE_SIZE, 0, apiKey)
        const data = await fetchWithRetry(url)
        if (data.status === '1' && Array.isArray(data.result)) {
            const txs = data.result.filter((tx: any) => tx.value !== '0').map((tx: any) => transformEvmTx(tx, walletLower, userId, chain, 'native'))
            nativeInserted = await saveTransactions(txs, supabase)
            nativeHasMore = data.result.length === PAGE_SIZE
        }
    }

    // Fetch ERC20 Tx page
    if (erc20Page < 999999) {
        const url = buildUrl(chain, 'account', 'tokentx', walletAddress, erc20Page, PAGE_SIZE, 0, apiKey)
        const data = await fetchWithRetry(url)
        if (data.status === '1' && Array.isArray(data.result)) {
            const txs = data.result.map((tx: any, idx: number) => {
                const logIdx = tx.logIndex ? parseInt(tx.logIndex) : -(erc20Page * 1000 + idx + 2)
                return transformEvmTx(tx, walletLower, userId, chain, 'erc20', logIdx)
            })
            erc20Inserted = await saveTransactions(txs, supabase)
            erc20HasMore = data.result.length === PAGE_SIZE
        }
    }

    return {
        totalInserted: nativeInserted + erc20Inserted,
        nativeTxs: { inserted: nativeInserted, hasMore: nativeHasMore, nextPage: nativePage + 1 },
        erc20Txs: { inserted: erc20Inserted, hasMore: erc20HasMore, nextPage: erc20Page + 1 }
    }
}

// --- EVM FULL SYNC ---
async function syncEvmChainFull(chain: any, walletAddress: string, userId: string, apiKey: string, supabase: any) {
    const PAGE_SIZE = 1000
    const walletLower = walletAddress.toLowerCase()
    let totalInserted = 0

    // Native Tx (Full)
    for (let page = 1; page <= 30; page++) {
        const url = buildUrl(chain, 'account', 'txlist', walletAddress, page, PAGE_SIZE, 0, apiKey)
        const data = await fetchWithRetry(url)
        if (data.status !== '1' || !Array.isArray(data.result) || data.result.length === 0) break
        const txs = data.result.filter((tx: any) => tx.value !== '0').map((tx: any) => transformEvmTx(tx, walletLower, userId, chain, 'native'))
        totalInserted += await saveTransactions(txs, supabase)
        if (data.result.length < PAGE_SIZE) break
    }

    // ERC20 Tx (Full)
    for (let page = 1; page <= 30; page++) {
        const url = buildUrl(chain, 'account', 'tokentx', walletAddress, page, PAGE_SIZE, 0, apiKey)
        const data = await fetchWithRetry(url)
        if (data.status !== '1' || !Array.isArray(data.result) || data.result.length === 0) break
        const txs = data.result.map((tx: any, idx: number) => {
            const logIdx = tx.logIndex ? parseInt(tx.logIndex) : -(page * 1000 + idx + 2)
            return transformEvmTx(tx, walletLower, userId, chain, 'erc20', logIdx)
        })
        totalInserted += await saveTransactions(txs, supabase)
        if (data.result.length < PAGE_SIZE) break
    }

    return totalInserted
}

// --- HELPERS ---

function buildUrl(chain: any, module: string, action: string, address: string, page: number, offset: number, startBlock: number, apiKey: string): string {
    const params = new URLSearchParams({
        module, action, address,
        startblock: String(startBlock),
        endblock: '99999999',
        page: String(page),
        offset: String(offset),
        sort: 'asc',
    })
    if (chain.chainIdParam) params.set('chainid', chain.chainIdParam)
    if (apiKey) params.set('apikey', apiKey)
    return `${chain.apiBase}?${params.toString()}`
}

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(url)
            if (res.status === 429) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)))
                continue
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return await res.json()
        } catch (err: any) {
            if (i === retries) throw err
            await new Promise(r => setTimeout(r, 1500 * (i + 1)))
        }
    }
}

function transformEvmTx(tx: any, address: string, userId: string, chain: any, type: 'native' | 'erc20', logIdx?: number) {
    const isOut = tx.from?.toLowerCase() === address
    const decimals = parseInt(tx.tokenDecimal || '18')
    const amount = parseFloat(tx.value) / Math.pow(10, type === 'erc20' ? decimals : 18)

    return {
        user_id: userId,
        wallet_address: address,
        tx_hash: tx.hash,
        chain: chain.name,
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        amount: Math.abs(amount),
        asset: type === 'erc20' ? (tx.tokenSymbol || 'ERC20') : chain.symbol,
        asset_decimals: type === 'erc20' ? decimals : 18,
        direction: isOut ? 'OUTGOING' : 'INCOMING',
        type: isOut ? 'WITHDRAWAL' : 'DEPOSIT',
        from_address: tx.from,
        to_address: tx.to,
        description: `${type === 'erc20' ? 'ERC20' : 'Native'} transaction on ${chain.label}`,
        source: 'wallet',
        log_index: logIdx ?? 0,
        token_address: type === 'erc20' ? tx.contractAddress?.toLowerCase() : null,
        metadata: {
            block_number: tx.blockNumber,
            gas_used: tx.gasUsed,
            gas_price: tx.gasPrice,
            is_error: tx.isError || '0',
            tx_type: type
        }
    }
}

async function saveTransactions(txs: any[], supabase: any): Promise<number> {
    if (txs.length === 0) return 0
    const { data: insertedCount, error } = await supabase.rpc('insert_wallet_transactions', {
        p_transactions: txs
    })
    if (error) {
        console.error('[SYNC] Save Error:', error)
        throw error
    }
    return insertedCount || 0
}

// BTC Transformations (from Blockstream)
function transformBitcoinTx(tx: any, address: string, userId: string) {
    const vout = tx.vout.filter((v: any) => v.scriptpubkey_address === address)
    const vin = tx.vin.filter((v: any) => v.prevout?.scriptpubkey_address === address)
    const amountOut = vout.reduce((sum: number, v: any) => sum + v.value, 0) / 1e8
    const amountIn = vin.reduce((sum: number, v: any) => sum + v.prevout?.value, 0) / 1e8
    const isOut = vin.length > 0
    const amount = isOut ? (amountIn - (tx.vout.find((v: any) => v.scriptpubkey_address === address)?.value / 1e8 || 0)) : amountOut

    return {
        user_id: userId,
        wallet_address: address,
        tx_hash: tx.txid,
        chain: 'bitcoin',
        timestamp: new Date(tx.status.block_time * 1000).toISOString(),
        amount: Math.abs(amount),
        asset: 'BTC',
        asset_decimals: 8,
        direction: isOut ? 'OUTGOING' : 'INCOMING',
        type: isOut ? 'WITHDRAWAL' : 'DEPOSIT',
        from_address: isOut ? address : 'external',
        to_address: isOut ? 'external' : address,
        description: 'Bitcoin transaction',
        source: 'wallet',
        log_index: 0,
        metadata: { provider: 'blockstream', status: tx.status }
    }
}

// Solana Fetch & Transform
async function fetchSolanaTransactions(address: string, rpcUrl: string) {
    const conn = new Connection(rpcUrl)
    const pubkey = new PublicKey(address)
    const signatures = await conn.getSignaturesForAddress(pubkey, { limit: 100 })
    const txs = []
    for (const sig of signatures) {
        const tx = await conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 })
        if (tx) txs.push({ ...tx, signature: sig.signature, blockTime: sig.blockTime })
    }
    return txs
}

function transformSolanaTx(tx: any, address: string, userId: string) {
    const preBal = tx.meta.preBalances[0] / 1e9
    const postBal = tx.meta.postBalances[0] / 1e9
    const isOut = tx.transaction.message.accountKeys[0].pubkey.toString() === address
    const amount = Math.abs(postBal - preBal)

    return {
        user_id: userId,
        wallet_address: address,
        tx_hash: tx.signature,
        chain: 'solana',
        timestamp: new Date(tx.blockTime * 1000).toISOString(),
        amount: amount,
        asset: 'SOL',
        asset_decimals: 9,
        direction: isOut ? 'OUTGOING' : 'INCOMING',
        type: isOut ? 'WITHDRAWAL' : 'DEPOSIT',
        description: 'Solana transaction',
        source: 'wallet',
        log_index: 0,
        metadata: { provider: 'solana_rpc' }
    }
}

async function fetchBitcoinTransactions(address: string) {
    const res = await fetch(`https://blockstream.info/api/address/${address}/txs`)
    if (!res.ok) return []
    return await res.json()
}

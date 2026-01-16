// supabase/functions/sync-wallet-transactions/index.ts
// UNIFIED Multi-chain Wallet Sync - Config-based chain support
// New chains can be added by simply updating SUPPORTED_CHAINS configuration

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ============================================================================
// CHAIN CONFIGURATION - Add new chains here!
// ============================================================================

type ChainConfig = {
    name: string;
    type: 'evm' | 'utxo' | 'solana';
    nativeSymbol: string;
    tatumEndpoint: string; // 'data' for Data API v4, 'v3/bitcoin' etc for specific endpoints
    addressPattern: RegExp;
    decimals?: number;
};

const SUPPORTED_CHAINS: ChainConfig[] = [
    // ========== EVM Chains (Data API v4) ==========
    { name: 'ethereum', type: 'evm', nativeSymbol: 'ETH', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'polygon', type: 'evm', nativeSymbol: 'MATIC', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'bsc', type: 'evm', nativeSymbol: 'BNB', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'avalanche', type: 'evm', nativeSymbol: 'AVAX', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'arbitrum', type: 'evm', nativeSymbol: 'ETH', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'optimism', type: 'evm', nativeSymbol: 'ETH', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'base', type: 'evm', nativeSymbol: 'ETH', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'fantom', type: 'evm', nativeSymbol: 'FTM', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'cronos', type: 'evm', nativeSymbol: 'CRO', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'celo', type: 'evm', nativeSymbol: 'CELO', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'gnosis', type: 'evm', nativeSymbol: 'xDAI', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'klaytn', type: 'evm', nativeSymbol: 'KLAY', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'flare', type: 'evm', nativeSymbol: 'FLR', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'haqq', type: 'evm', nativeSymbol: 'ISLM', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },
    { name: 'chiliz', type: 'evm', nativeSymbol: 'CHZ', tatumEndpoint: 'data', addressPattern: /^0x[a-fA-F0-9]{40}$/, decimals: 18 },

    // ========== UTXO Chains ==========
    { name: 'bitcoin', type: 'utxo', nativeSymbol: 'BTC', tatumEndpoint: 'v3/bitcoin', addressPattern: /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/, decimals: 8 },
    { name: 'bitcoin-testnet', type: 'utxo', nativeSymbol: 'tBTC', tatumEndpoint: 'v3/bitcoin-testnet', addressPattern: /^(tb1|m|n|2)[a-zA-HJ-NP-Z0-9]{25,90}$/, decimals: 8 },
    { name: 'litecoin', type: 'utxo', nativeSymbol: 'LTC', tatumEndpoint: 'v3/litecoin', addressPattern: /^(ltc1|[LM])[a-zA-HJ-NP-Z0-9]{25,90}$/, decimals: 8 },
    { name: 'dogecoin', type: 'utxo', nativeSymbol: 'DOGE', tatumEndpoint: 'v3/dogecoin', addressPattern: /^D[a-zA-HJ-NP-Z0-9]{25,90}$/, decimals: 8 },

    // ========== Solana ==========
    { name: 'solana', type: 'solana', nativeSymbol: 'SOL', tatumEndpoint: 'v3/solana', addressPattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, decimals: 9 },
];

// ============================================================================
// HELPERS
// ============================================================================

// Base58 decode for Solana address validation
function base58Decode(address: string): Uint8Array | null {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let decoded = BigInt(0);
    for (const char of address) {
        const index = ALPHABET.indexOf(char);
        if (index === -1) return null;
        decoded = decoded * BigInt(58) + BigInt(index);
    }
    const bytes: number[] = [];
    while (decoded > 0) {
        bytes.unshift(Number(decoded % BigInt(256)));
        decoded = decoded / BigInt(256);
    }
    return new Uint8Array(bytes);
}

// Detect chain from address
function detectChain(address: string): ChainConfig | null {
    const trimmed = address.trim();

    for (const chain of SUPPORTED_CHAINS) {
        if (chain.addressPattern.test(trimmed)) {
            // For Solana, validate 32-byte public key
            if (chain.type === 'solana') {
                const decoded = base58Decode(trimmed);
                if (!decoded || decoded.length !== 32) continue;
            }
            return chain;
        }
    }
    return null;
}

// Safe timestamp parsing
function safeParseTimestamp(value: any): Date {
    const now = new Date();
    const minDate = new Date('2009-01-01');
    const maxDate = new Date('2100-01-01');

    try {
        if (!value) return now;

        let date: Date;
        if (typeof value === 'number') {
            date = value > 1e12 ? new Date(value) : new Date(value * 1000);
        } else if (typeof value === 'string') {
            date = new Date(value);
        } else {
            return now;
        }

        if (isNaN(date.getTime()) || date < minDate || date > maxDate) {
            console.warn(`[TIMESTAMP] Invalid date: ${value}`);
            return now;
        }
        return date;
    } catch (err) {
        console.warn(`[TIMESTAMP] Error: ${value}`, err);
        return now;
    }
}

// ============================================================================
// UNIFIED FETCH FUNCTION
// ============================================================================

async function fetchTransactions(address: string, chain: ChainConfig, apiKey: string): Promise<any[]> {
    let url: string;

    if (chain.tatumEndpoint === 'data') {
        // Data API v4 (all EVM chains)
        url = `https://api.tatum.io/v4/data/transactions?chain=${chain.name}&addresses=${address}&pageSize=50`;
    } else if (chain.type === 'utxo') {
        // Bitcoin v3
        url = `https://api.tatum.io/${chain.tatumEndpoint}/transaction/address/${address}?pageSize=50`;
    } else if (chain.type === 'solana') {
        // Solana v3
        url = `https://api.tatum.io/${chain.tatumEndpoint}/account/${address}/transactions?limit=50`;
    } else {
        throw new Error(`Unsupported chain endpoint: ${chain.tatumEndpoint}`);
    }

    console.log(`[${chain.nativeSymbol}] Fetching: ${url}`);

    const response = await fetch(url, {
        headers: { 'Accept': 'application/json', 'x-api-key': apiKey }
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[${chain.nativeSymbol}] API error ${response.status}: ${errorBody}`);
        throw new Error(`Tatum API error for ${chain.name}: ${response.status}`);
    }

    const data = await response.json();
    return chain.tatumEndpoint === 'data' ? (data.result || []) : (Array.isArray(data) ? data : []);
}

// ============================================================================
// TRANSACTION PARSING
// ============================================================================

function parseTransaction(tx: any, chain: ChainConfig, userAddress: string, userId: string, walletAddress: string): any {
    let txHash: string;
    let txDate: Date;
    let amount: number;
    let txType: string;

    if (chain.type === 'utxo') {
        // Bitcoin
        txHash = tx.hash || tx.txId;
        txDate = safeParseTimestamp(tx.time);

        let inValue = 0, outValue = 0;
        if (tx.inputs) {
            for (const input of tx.inputs) {
                if (input.coin?.address?.toLowerCase() === userAddress.toLowerCase()) {
                    inValue += parseFloat(input.coin.value || '0');
                }
            }
        }
        if (tx.outputs) {
            for (const output of tx.outputs) {
                if (output.address?.toLowerCase() === userAddress.toLowerCase()) {
                    outValue += parseFloat(output.value || '0');
                }
            }
        }

        const netSatoshis = outValue - inValue;
        amount = Math.abs(netSatoshis) / Math.pow(10, chain.decimals!);
        txType = netSatoshis >= 0 ? 'DEPOSIT' : 'WITHDRAWAL';

    } else if (chain.type === 'solana') {
        // Solana
        txHash = tx.signature || tx.hash;
        txDate = safeParseTimestamp(tx.blockTime || tx.timestamp);

        const preBalance = tx.meta?.preBalances?.[0] || 0;
        const postBalance = tx.meta?.postBalances?.[0] || 0;
        const netLamports = postBalance - preBalance;
        amount = Math.abs(netLamports) / Math.pow(10, chain.decimals!);
        txType = netLamports >= 0 ? 'DEPOSIT' : 'WITHDRAWAL';

    } else {
        // EVM
        txHash = tx.hash || tx.transactionHash;
        txDate = safeParseTimestamp(tx.timestamp || tx.blockTimestamp);

        const decimals = tx.tokenDecimals || chain.decimals || 18;
        amount = tx.amount ? parseFloat(tx.amount) : (tx.value ? parseFloat(tx.value) / Math.pow(10, decimals) : 0);

        const isOutgoing = tx.address?.toLowerCase() === userAddress.toLowerCase() && tx.counterAddress;
        txType = isOutgoing ? 'WITHDRAWAL' : 'DEPOSIT';
    }

    return {
        user_id: userId,
        wallet_address: walletAddress,
        tx_hash: txHash,
        chain: chain.name.replace('-testnet', ''),
        date: txDate,
        amount: amount,
        asset: chain.nativeSymbol,
        value_in_usd: null,
        type: txType,
        description: `${chain.nativeSymbol} transaction`,
        source: 'wallet',
        occurred_at: txDate,
        timestamp: txDate,
        direction: txType === 'WITHDRAWAL' ? 'out' : 'in',
        asset_symbol: chain.nativeSymbol,
        fiat_value_usd: null,
        metadata: { raw_response: tx, provider: 'tatum', chain_type: chain.type }
    };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Authenticate
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const jwt = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
        if (userError || !user) {
            return new Response(JSON.stringify({ error: userError?.message || 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Get wallet address
        const { walletAddress } = await req.json();
        if (!walletAddress) {
            return new Response(JSON.stringify({ error: 'walletAddress is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const trimmedAddress = walletAddress.trim();
        console.log(`Starting sync for wallet: ${trimmedAddress}`);

        // Check API key
        const TATUM_API_KEY = Deno.env.get('TATUM_API_KEY');
        if (!TATUM_API_KEY) {
            return new Response(JSON.stringify({ message: 'Sync skipped: Tatum not configured.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Detect chain
        const chainConfig = detectChain(trimmedAddress);
        if (!chainConfig) {
            console.log(`Unable to detect chain for address: ${trimmedAddress}`);
            return new Response(JSON.stringify({
                message: 'Sync skipped: Unable to detect blockchain.',
                skipped: true,
                reason: 'unknown_chain'
            }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`Detected: ${chainConfig.name} (${chainConfig.nativeSymbol})`);

        // Fetch transactions
        let rawTransactions: any[] = [];
        try {
            rawTransactions = await fetchTransactions(trimmedAddress, chainConfig, TATUM_API_KEY);
        } catch (apiError: any) {
            return new Response(JSON.stringify({
                error: apiError.message,
                chain: chainConfig.name
            }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`Fetched ${rawTransactions.length} transactions`);

        // Parse and transform
        const recordsToUpsert = rawTransactions.map(tx =>
            parseTransaction(tx, chainConfig, trimmedAddress, user.id, walletAddress)
        );

        if (recordsToUpsert.length === 0) {
            return new Response(JSON.stringify({ message: 'No new transactions.', chain: chainConfig.name }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Upsert
        console.log(`Upserting ${recordsToUpsert.length} records...`);
        const { error: upsertError } = await supabaseClient.from('wallet_transactions').upsert(recordsToUpsert, { onConflict: 'tx_hash,user_id,chain' });
        if (upsertError) {
            throw new Error(`Supabase upsert error: ${upsertError.message}`);
        }

        return new Response(JSON.stringify({
            message: `Sync successful. ${recordsToUpsert.length} transactions processed.`,
            chain: chainConfig.name,
            transactionCount: recordsToUpsert.length
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        console.error('CRITICAL ERROR:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

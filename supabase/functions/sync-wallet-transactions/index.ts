
// supabase/functions/sync-wallet-transactions/index.ts
// TATUM API Integration - Multi-chain support (Bitcoin, Ethereum, etc.)
// Note: Uses different endpoints for EVM vs Bitcoin chains

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Chain type definitions
type ChainInfo = {
    type: 'evm' | 'bitcoin';
    chain: string;
    nativeSymbol: string;
    isTestnet: boolean;
};

// Detect blockchain from address format
function detectChain(address: string): ChainInfo | null {
    const trimmed = address.trim();

    // EVM chains (Ethereum, Polygon, BSC, etc.) - 0x prefix, 40 hex characters
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
        return { type: 'evm', chain: 'ethereum', nativeSymbol: 'ETH', isTestnet: false };
    }

    // Bitcoin Mainnet - bc1 (bech32), 1 (P2PKH), 3 (P2SH)
    if (/^(bc1|1|3)[a-zA-HJ-NP-Z0-9]{25,}$/.test(trimmed)) {
        return { type: 'bitcoin', chain: 'bitcoin-mainnet', nativeSymbol: 'BTC', isTestnet: false };
    }

    // Bitcoin Testnet - tb1, m, n, 2
    if (/^(tb1|m|n|2)[a-zA-HJ-NP-Z0-9]{25,}$/.test(trimmed)) {
        return { type: 'bitcoin', chain: 'bitcoin-testnet', nativeSymbol: 'tBTC', isTestnet: true };
    }

    return null;
}

// Fetch EVM transactions using Tatum Data API v4
async function fetchEvmTransactions(address: string, apiKey: string): Promise<any[]> {
    // Tatum Data API supported chains: ethereum, polygon, bsc, celo, chiliz
    const url = `https://api.tatum.io/v4/data/transactions?chain=ethereum&addresses=${address}&pageSize=50`;
    console.log(`[EVM] Calling Tatum Data API: ${url}`);

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'x-api-key': apiKey
        }
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[EVM] Tatum API error. Status: ${response.status}, Body: ${errorBody}`);
        throw new Error(`Tatum EVM API error: ${response.status}`);
    }

    const data = await response.json();
    return data.result || [];
}

// Fetch Bitcoin transactions using Tatum Bitcoin API v3
async function fetchBitcoinTransactions(address: string, apiKey: string, isTestnet: boolean): Promise<any[]> {
    // Tatum uses 'bitcoin' for mainnet, 'bitcoin-testnet' for testnet
    const network = isTestnet ? 'bitcoin-testnet' : 'bitcoin';
    const url = `https://api.tatum.io/v3/${network}/transaction/address/${address}?pageSize=50`;
    console.log(`[BTC] Calling Tatum Bitcoin API: ${url}`);

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'x-api-key': apiKey
        }
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[BTC] Tatum API error. Status: ${response.status}, Body: ${errorBody}`);

        // If mainnet fails with testnet key, inform user
        if (!isTestnet && response.status === 400) {
            throw new Error(`Bitcoin mainnet requires a mainnet API key. You are using a testnet key. Please use testnet addresses (starting with tb1, m, n, or 2) or upgrade to a mainnet API key.`);
        }
        throw new Error(`Tatum Bitcoin API error: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Authenticate user
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const jwt = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
        if (userError || !user) {
            return new Response(JSON.stringify({ error: userError?.message || 'User not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 2. Get wallet address
        const { walletAddress } = await req.json();
        if (!walletAddress) {
            return new Response(JSON.stringify({ error: 'walletAddress is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const trimmedAddress = walletAddress.trim();
        console.log(`Starting sync for wallet: [${trimmedAddress}]`);

        // 3. Check for Tatum API Key
        const TATUM_API_KEY = Deno.env.get('TATUM_API_KEY');
        if (!TATUM_API_KEY) {
            console.warn(`TATUM_API_KEY is not set. Skipping sync for wallet ${trimmedAddress}.`);
            return new Response(JSON.stringify({ message: 'Sync skipped: Tatum integration is not configured.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 4. Detect chain from address format
        const chainInfo = detectChain(trimmedAddress);
        if (!chainInfo) {
            console.log(`Unable to detect chain for address: ${trimmedAddress}`);
            return new Response(JSON.stringify({
                message: 'Sync skipped: Unable to detect blockchain type from address format.',
                skipped: true,
                reason: 'unknown_chain'
            }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`Detected: type=${chainInfo.type}, chain=${chainInfo.chain}, symbol=${chainInfo.nativeSymbol}, testnet=${chainInfo.isTestnet}`);

        // 5. Fetch transactions based on chain type
        let rawTransactions: any[] = [];

        try {
            if (chainInfo.type === 'evm') {
                rawTransactions = await fetchEvmTransactions(trimmedAddress, TATUM_API_KEY);
            } else if (chainInfo.type === 'bitcoin') {
                rawTransactions = await fetchBitcoinTransactions(trimmedAddress, TATUM_API_KEY, chainInfo.isTestnet);
            }
        } catch (apiError: any) {
            return new Response(JSON.stringify({
                error: apiError.message,
                chain: chainInfo.chain,
                suggestion: chainInfo.type === 'bitcoin' && !chainInfo.isTestnet
                    ? 'Your API key is for testnet. Use a Bitcoin testnet address (tb1..., m..., n...) or get a mainnet API key.'
                    : undefined
            }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`Fetched ${rawTransactions.length} transactions from Tatum`);

        // 6. Transform transactions to our schema
        let recordsToUpsert: any[] = [];

        for (const tx of rawTransactions) {
            let txHash: string;
            let txDate: Date;
            let amount: number;
            let txType: string;

            if (chainInfo.type === 'bitcoin') {
                // Bitcoin transaction format
                txHash = tx.hash || tx.txId;
                txDate = new Date(tx.time ? tx.time * 1000 : Date.now());

                // Calculate amount from inputs/outputs
                let inValue = 0, outValue = 0;
                if (tx.inputs) {
                    for (const input of tx.inputs) {
                        if (input.coin?.address?.toLowerCase() === trimmedAddress.toLowerCase()) {
                            inValue += parseFloat(input.coin.value || '0');
                        }
                    }
                }
                if (tx.outputs) {
                    for (const output of tx.outputs) {
                        if (output.address?.toLowerCase() === trimmedAddress.toLowerCase()) {
                            outValue += parseFloat(output.value || '0');
                        }
                    }
                }

                // Net amount (satoshis to BTC)
                const netSatoshis = outValue - inValue;
                amount = Math.abs(netSatoshis) / 100000000;
                txType = netSatoshis >= 0 ? 'DEPOSIT' : 'WITHDRAWAL';
            } else {
                // EVM transaction format
                txHash = tx.hash || tx.transactionHash;
                txDate = new Date(tx.timestamp ? tx.timestamp * 1000 : tx.blockTimestamp || Date.now());

                const decimals = tx.tokenDecimals || 18;
                amount = tx.amount ? parseFloat(tx.amount) : (tx.value ? parseFloat(tx.value) / (10 ** decimals) : 0);

                const isOutgoing = tx.address?.toLowerCase() === trimmedAddress.toLowerCase() && tx.counterAddress;
                txType = isOutgoing ? 'WITHDRAWAL' : 'DEPOSIT';
            }

            const record = {
                user_id: user.id,
                wallet_address: walletAddress,
                tx_hash: txHash,
                chain: chainInfo.chain.replace('-mainnet', '').replace('-testnet', ''),
                date: txDate,
                amount: amount,
                asset: chainInfo.nativeSymbol,
                value_in_usd: null,
                type: txType,
                description: `${chainInfo.nativeSymbol} transaction`,
                source: 'wallet',

                // Legacy compatibility
                occurred_at: txDate,
                timestamp: txDate,
                direction: txType === 'WITHDRAWAL' ? 'out' : 'in',
                asset_symbol: chainInfo.nativeSymbol,
                fiat_value_usd: null,
                metadata: { raw_response: tx, provider: 'tatum', chain_type: chainInfo.type }
            };

            recordsToUpsert.push(record);
        }

        // 7. Upsert records to Supabase
        if (recordsToUpsert.length === 0) {
            return new Response(JSON.stringify({ message: 'No new transactions found.', chain: chainInfo.chain }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`Upserting ${recordsToUpsert.length} records...`);
        const { error: upsertError } = await supabaseClient.from('wallet_transactions').upsert(recordsToUpsert, { onConflict: 'tx_hash,user_id,chain' });
        if (upsertError) {
            throw new Error(`Supabase upsert error: ${upsertError.message}`);
        }

        return new Response(JSON.stringify({
            message: `Sync successful. ${recordsToUpsert.length} transactions processed.`,
            chain: chainInfo.chain,
            transactionCount: recordsToUpsert.length
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error('CRITICAL ERROR in sync-wallet-transactions:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

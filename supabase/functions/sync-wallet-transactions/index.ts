
// supabase/functions/sync-wallet-transactions/index.ts
// Multi-Chain Wallet Transaction Sync
// Supports: EVM chains (Moralis), Bitcoin (Tatum), Solana (Moralis)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Moralis supported EVM chains
const MORALIS_CHAINS = [
    { id: '0x1', name: 'eth', symbol: 'ETH', label: 'Ethereum' },
    { id: '0x89', name: 'polygon', symbol: 'MATIC', label: 'Polygon' },
    { id: '0x38', name: 'bsc', symbol: 'BNB', label: 'BNB Chain' },
    { id: '0xa4b1', name: 'arbitrum', symbol: 'ETH', label: 'Arbitrum' },
    { id: '0xa', name: 'optimism', symbol: 'ETH', label: 'Optimism' },
    { id: '0xa86a', name: 'avalanche', symbol: 'AVAX', label: 'Avalanche' },
    { id: '0x2105', name: 'base', symbol: 'ETH', label: 'Base' },
    { id: '0xfa', name: 'fantom', symbol: 'FTM', label: 'Fantom' },
    { id: '0x19', name: 'cronos', symbol: 'CRO', label: 'Cronos' },
    { id: '0x64', name: 'gnosis', symbol: 'xDAI', label: 'Gnosis' },
    { id: '0xe708', name: 'linea', symbol: 'ETH', label: 'Linea' },
];

// Address type detection
type AddressType = 'evm' | 'bitcoin' | 'solana' | 'unknown';

function detectAddressType(address: string): AddressType {
    const trimmed = address.trim();

    // EVM: 0x prefix, 40 hex chars
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
        return 'evm';
    }

    // Bitcoin: bc1 (bech32), 1 (P2PKH), 3 (P2SH)
    if (/^(bc1|1|3)[a-zA-HJ-NP-Z0-9]{25,}$/.test(trimmed)) {
        return 'bitcoin';
    }

    // Bitcoin Testnet
    if (/^(tb1|m|n|2)[a-zA-HJ-NP-Z0-9]{25,}$/.test(trimmed)) {
        return 'bitcoin';
    }

    // Solana: Base58, 32-44 chars (no 0, O, I, l)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
        return 'solana';
    }

    return 'unknown';
}

// Fetch EVM transactions from Moralis (all chains)
async function fetchMoralisEvmTransactions(address: string, apiKey: string): Promise<any[]> {
    const allTransactions: any[] = [];

    for (const chain of MORALIS_CHAINS) {
        try {
            // Native transactions
            const nativeUrl = `https://deep-index.moralis.io/api/v2.2/${address}?chain=${chain.name}&limit=100`;
            const nativeRes = await fetch(nativeUrl, {
                headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
            });

            if (nativeRes.ok) {
                const nativeData = await nativeRes.json();
                if (nativeData.result && nativeData.result.length > 0) {
                    console.log(`[Moralis] Found ${nativeData.result.length} native txs on ${chain.label}`);
                    for (const tx of nativeData.result) {
                        allTransactions.push({
                            ...tx,
                            _chain: chain.name,
                            _chainLabel: chain.label,
                            _nativeSymbol: chain.symbol,
                            _type: 'native'
                        });
                    }
                }
            }

            // ERC20 token transfers
            const erc20Url = `https://deep-index.moralis.io/api/v2.2/${address}/erc20/transfers?chain=${chain.name}&limit=100`;
            const erc20Res = await fetch(erc20Url, {
                headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
            });

            if (erc20Res.ok) {
                const erc20Data = await erc20Res.json();
                if (erc20Data.result && erc20Data.result.length > 0) {
                    console.log(`[Moralis] Found ${erc20Data.result.length} ERC20 txs on ${chain.label}`);
                    for (const tx of erc20Data.result) {
                        allTransactions.push({
                            ...tx,
                            _chain: chain.name,
                            _chainLabel: chain.label,
                            _nativeSymbol: chain.symbol,
                            _type: 'erc20'
                        });
                    }
                }
            }
        } catch (err) {
            console.warn(`[Moralis] Error fetching ${chain.label}:`, err);
        }
    }

    return allTransactions;
}

// Fetch Solana transactions from Moralis
async function fetchMoralisSolanaTransactions(address: string, apiKey: string): Promise<any[]> {
    const allTransactions: any[] = [];

    try {
        // Solana native transactions
        const url = `https://solana-gateway.moralis.io/account/mainnet/${address}/transactions`;
        const res = await fetch(url, {
            headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
        });

        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                console.log(`[Moralis] Found ${data.length} Solana txs`);
                for (const tx of data) {
                    allTransactions.push({
                        ...tx,
                        _chain: 'solana',
                        _chainLabel: 'Solana',
                        _nativeSymbol: 'SOL',
                        _type: 'native'
                    });
                }
            }
        }

        // SPL token transfers
        const splUrl = `https://solana-gateway.moralis.io/account/mainnet/${address}/tokens`;
        const splRes = await fetch(splUrl, {
            headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
        });

        if (splRes.ok) {
            const splData = await splRes.json();
            // Note: This returns balances, not transfer history
            // For full transfer history, would need additional API calls
        }
    } catch (err) {
        console.warn('[Moralis] Error fetching Solana:', err);
    }

    return allTransactions;
}

// Fetch Bitcoin transactions from Tatum
async function fetchTatumBitcoinTransactions(address: string, apiKey: string): Promise<any[]> {
    const isTestnet = /^(tb1|m|n|2)/.test(address);
    const network = isTestnet ? 'bitcoin-testnet' : 'bitcoin';
    const url = `https://api.tatum.io/v3/${network}/transaction/address/${address}?pageSize=50`;

    console.log(`[Tatum] Fetching Bitcoin (${isTestnet ? 'testnet' : 'mainnet'}) transactions`);

    const response = await fetch(url, {
        headers: { 'Accept': 'application/json', 'x-api-key': apiKey }
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[Tatum] API error: ${response.status}`, errorBody);
        return [];
    }

    const data = await response.json();
    const transactions = Array.isArray(data) ? data : [];

    return transactions.map(tx => ({
        ...tx,
        _chain: 'bitcoin',
        _chainLabel: 'Bitcoin',
        _nativeSymbol: isTestnet ? 'tBTC' : 'BTC',
        _type: 'native',
        _isTestnet: isTestnet
    }));
}

// Transform Moralis EVM transaction to our schema
function transformMoralisEvmTx(tx: any, address: string, userId: string): any {
    const isOutgoing = tx.from_address?.toLowerCase() === address.toLowerCase();

    let amount: number;
    let asset: string;
    let valueUsd: number | null = null;

    if (tx._type === 'erc20') {
        // ERC20 token transfer
        const decimals = parseInt(tx.token_decimals || '18');
        amount = parseFloat(tx.value) / Math.pow(10, decimals);
        asset = tx.token_symbol || 'UNKNOWN';

        // Try to get USD value from Moralis
        if (tx.value_decimal) {
            amount = parseFloat(tx.value_decimal);
        }
    } else {
        // Native transaction
        amount = parseFloat(tx.value) / 1e18;
        asset = tx._nativeSymbol;

        // Moralis provides value directly sometimes
        if (tx.value && !isNaN(parseFloat(tx.value))) {
            // value is in wei, convert to ether
            amount = parseFloat(tx.value) / 1e18;
        }
    }

    return {
        user_id: userId,
        wallet_address: address,
        tx_hash: tx.hash || tx.transaction_hash,
        chain: tx._chain,
        timestamp: new Date(tx.block_timestamp),
        amount: Math.abs(amount),
        asset: asset,
        value_in_usd: valueUsd,
        type: isOutgoing ? 'WITHDRAWAL' : 'DEPOSIT',
        description: `${asset} ${isOutgoing ? 'sent' : 'received'} on ${tx._chainLabel}`,
        source: 'wallet',
        metadata: {
            raw_response: tx,
            provider: 'moralis',
            chain_label: tx._chainLabel,
            tx_type: tx._type
        }
    };
}

// Transform Moralis Solana transaction to our schema
function transformMoralisSolanaTx(tx: any, address: string, userId: string): any {
    // Solana transaction structure is different
    const isOutgoing = tx.feePayer === address;

    return {
        user_id: userId,
        wallet_address: address,
        tx_hash: tx.signature || tx.hash,
        chain: 'solana',
        timestamp: new Date(tx.blockTime ? tx.blockTime * 1000 : Date.now()),
        amount: tx.lamports ? tx.lamports / 1e9 : 0,
        asset: 'SOL',
        value_in_usd: null,
        type: isOutgoing ? 'WITHDRAWAL' : 'DEPOSIT',
        description: `SOL transaction on Solana`,
        source: 'wallet',
        metadata: { raw_response: tx, provider: 'moralis', chain_label: 'Solana' }
    };
}

// Transform Tatum Bitcoin transaction to our schema
function transformTatumBitcoinTx(tx: any, address: string, userId: string): any {
    const txHash = tx.hash || tx.txId;
    const txDate = new Date(tx.time ? tx.time * 1000 : Date.now());

    // Calculate amount from inputs/outputs
    let inValue = 0, outValue = 0;
    if (tx.inputs) {
        for (const input of tx.inputs) {
            if (input.coin?.address?.toLowerCase() === address.toLowerCase()) {
                inValue += parseFloat(input.coin.value || '0');
            }
        }
    }
    if (tx.outputs) {
        for (const output of tx.outputs) {
            if (output.address?.toLowerCase() === address.toLowerCase()) {
                outValue += parseFloat(output.value || '0');
            }
        }
    }

    const netSatoshis = outValue - inValue;
    const amount = Math.abs(netSatoshis) / 100000000;
    const txType = netSatoshis >= 0 ? 'DEPOSIT' : 'WITHDRAWAL';

    return {
        user_id: userId,
        wallet_address: address,
        tx_hash: txHash,
        chain: 'bitcoin',
        timestamp: txDate,
        amount: amount,
        asset: tx._nativeSymbol,
        value_in_usd: null,
        type: txType,
        description: `${tx._nativeSymbol} transaction`,
        source: 'wallet',
        metadata: { raw_response: tx, provider: 'tatum', chain_label: tx._chainLabel }
    };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Authenticate user
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const jwt = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
        if (userError || !user) {
            return new Response(JSON.stringify({ error: userError?.message || 'User not authenticated' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 2. Get wallet address
        const { walletAddress } = await req.json();
        if (!walletAddress) {
            return new Response(JSON.stringify({ error: 'walletAddress is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const address = walletAddress.trim();
        console.log(`[SYNC] Starting multi-chain sync for: ${address}`);

        // 3. Detect address type
        const addressType = detectAddressType(address);
        console.log(`[SYNC] Detected address type: ${addressType}`);

        if (addressType === 'unknown') {
            return new Response(JSON.stringify({
                error: 'Unable to detect blockchain type from address format',
                address: address
            }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 4. Get API keys
        const MORALIS_API_KEY = Deno.env.get('MORALIS_API_KEY');
        const TATUM_API_KEY = Deno.env.get('TATUM_API_KEY');

        // 5. Fetch transactions based on address type
        let rawTransactions: any[] = [];
        let chainsScanned: string[] = [];

        if (addressType === 'evm' && MORALIS_API_KEY) {
            console.log('[SYNC] Fetching EVM transactions from Moralis...');
            rawTransactions = await fetchMoralisEvmTransactions(address, MORALIS_API_KEY);
            chainsScanned = MORALIS_CHAINS.map(c => c.label);
        } else if (addressType === 'solana' && MORALIS_API_KEY) {
            console.log('[SYNC] Fetching Solana transactions from Moralis...');
            rawTransactions = await fetchMoralisSolanaTransactions(address, MORALIS_API_KEY);
            chainsScanned = ['Solana'];
        } else if (addressType === 'bitcoin' && TATUM_API_KEY) {
            console.log('[SYNC] Fetching Bitcoin transactions from Tatum...');
            rawTransactions = await fetchTatumBitcoinTransactions(address, TATUM_API_KEY);
            chainsScanned = ['Bitcoin'];
        } else {
            return new Response(JSON.stringify({
                error: 'No API key configured for this chain type',
                addressType: addressType
            }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[SYNC] Total transactions fetched: ${rawTransactions.length}`);

        // 6. Transform transactions
        let recordsToUpsert: any[] = [];

        for (const tx of rawTransactions) {
            let record: any;

            if (addressType === 'evm') {
                record = transformMoralisEvmTx(tx, address, user.id);
            } else if (addressType === 'solana') {
                record = transformMoralisSolanaTx(tx, address, user.id);
            } else if (addressType === 'bitcoin') {
                record = transformTatumBitcoinTx(tx, address, user.id);
            }

            if (record && record.tx_hash) {
                recordsToUpsert.push(record);
            }
        }

        // 7. Upsert to database
        if (recordsToUpsert.length === 0) {
            return new Response(JSON.stringify({
                message: 'No transactions found',
                chainsScanned: chainsScanned,
                transactionCount: 0
            }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.log(`[SYNC] Upserting ${recordsToUpsert.length} records...`);

        const { error: upsertError } = await supabaseClient
            .from('wallet_transactions')
            .upsert(recordsToUpsert, { onConflict: 'tx_hash,user_id,chain' });

        if (upsertError) {
            console.error('[SYNC] Upsert error:', upsertError);
            throw new Error(`Database error: ${upsertError.message}`);
        }

        // 8. Group by chain for response
        const chainCounts: Record<string, number> = {};
        for (const r of recordsToUpsert) {
            chainCounts[r.chain] = (chainCounts[r.chain] || 0) + 1;
        }

        return new Response(JSON.stringify({
            message: `Sync successful`,
            chainsScanned: chainsScanned,
            transactionCount: recordsToUpsert.length,
            breakdown: chainCounts
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error('[SYNC] CRITICAL ERROR:', err);
        return new Response(JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});

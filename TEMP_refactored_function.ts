// THIS IS A TEMP FILE - Complete refactored fetchEtherscanTransactions function
// Copy this to replace the existing function in index.ts

// Fetch EVM transactions from Etherscan family APIs with pagination support
// Processes ONE chain per call to avoid CPU limits
async function fetchEtherscanTransactions(
    address: string,
    apiKey: string,
    supabase: any,
    userId: string,
    options: {
        chainId?: string,      // Specific chain to process (e.g., "0x1")
        nativePage?: number,   // Page number for native transactions
        erc20Page?: number,    // Page number for ERC20 token transfers
        limit?: number         // Transactions per page (default: 250)
    } = {}
): Promise<{
    chainId: string,
    chainLabel: string,
    nativeTxs: { inserted: number, hasMore: boolean, nextPage: number },
    erc20Txs: { inserted: number, hasMore: boolean, nextPage: number },
    totalInserted: number
}> {
    const { chainId, nativePage = 1, erc20Page = 1, limit = 250 } = options;

    // Find target chain (default to Ethereum if not specified)
    const targetChain = chainId
        ? ETHERSCAN_CHAINS.find(c => c.id === chainId)
        : ETHERSCAN_CHAINS[0];

    if (!targetChain) {
        throw new Error(`Invalid chainId: ${chainId}`);
    }

    console.log(`[Etherscan] Syncing ${targetChain.label} - Native page ${nativePage}, ERC20 page ${erc20Page}`);

    let nativeInserted = 0;
    let erc20Inserted = 0;
    let nativeHasMore = false;
    let erc20HasMore = false;

    try {
        // ===== FETCH NATIVE TRANSACTIONS =====
        const nativeUrl = `${targetChain.apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${nativePage}&offset=${limit}&sort=desc&apikey=${apiKey}`;
        console.log(`[Etherscan] Fetching native txs: page ${nativePage}`);

        const nativeRes = await fetch(nativeUrl);

        if (nativeRes.ok) {
            const nativeData = await nativeRes.json();

            if (nativeData.status === '1' && nativeData.result && nativeData.result.length > 0) {
                console.log(`[Etherscan] Found ${nativeData.result.length} native txs`);

                // Transform and insert in batches
                const recordsToUpsert: any[] = [];
                for (const tx of nativeData.result) {
                    const txWithMeta = {
                        ...tx,
                        _chain: targetChain.name,
                        _chainLabel: targetChain.label,
                        _nativeSymbol: targetChain.symbol,
                        _type: 'native',
                        _source: 'etherscan'
                    };
                    const record = transformMoralisEvmTx(txWithMeta, address, userId);
                    if (record && record.tx_hash) {
                        recordsToUpsert.push(record);
                    }
                }

                // Insert in batches
                const batchSize = 500;
                for (let i = 0; i < recordsToUpsert.length; i += batchSize) {
                    const batch = recordsToUpsert.slice(i, i + batchSize);
                    const { error } = await supabase
                        .from('wallet_transactions')
                        .upsert(batch, {
                            onConflict: 'user_id,tx_hash',
                            ignoreDuplicates: false
                        });

                    if (error) {
                        console.error(`[DB Error] Failed to insert native batch:`, error);
                    } else {
                        nativeInserted += batch.length;
                        console.log(`[DB] Inserted ${batch.length} native records`);
                    }
                }

                // Check if there are more pages
                nativeHasMore = nativeData.result.length >= limit;
            } else {
                console.log(`[Etherscan] No more native transactions`);
            }
        } else {
            console.error(`[Etherscan Error] HTTP ${nativeRes.status}`);
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 350));

        // ===== FETCH ERC20 TRANSACTIONS =====
        const erc20Url = `${targetChain.apiUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=${erc20Page}&offset=${limit}&sort=desc&apikey=${apiKey}`;
        console.log(`[Etherscan] Fetching ERC20 txs: page ${erc20Page}`);

        const erc20Res = await fetch(erc20Url);

        if (erc20Res.ok) {
            const erc20Data = await erc20Res.json();

            if (erc20Data.status === '1' && erc20Data.result && erc20Data.result.length > 0) {
                console.log(`[Etherscan] Found ${erc20Data.result.length} ERC20 txs`);

                // Transform and insert in batches
                const recordsToUpsert: any[] = [];
                for (const tx of erc20Data.result) {
                    const txWithMeta = {
                        ...tx,
                        _chain: targetChain.name,
                        _chainLabel: targetChain.label,
                        _nativeSymbol: targetChain.symbol,
                        _type: 'erc20',
                        _source: 'etherscan'
                    };
                    const record = transformMoralisEvmTx(txWithMeta, address, userId);
                    if (record && record.tx_hash) {
                        recordsToUpsert.push(record);
                    }
                }

                // Insert in batches
                const batchSize = 500;
                for (let i = 0; i < recordsToUpsert.length; i += batchSize) {
                    const batch = recordsToUpsert.slice(i, i + batchSize);
                    const { error } = await supabase
                        .from('wallet_transactions')
                        .upsert(batch, {
                            onConflict: 'user_id,tx_hash',
                            ignoreDuplicates: false
                        });

                    if (error) {
                        console.error(`[DB Error] Failed to insert ERC20 batch:`, error);
                    } else {
                        erc20Inserted += batch.length;
                        console.log(`[DB] Inserted ${batch.length} ERC20 records`);
                    }
                }

                // Check if there are more pages
                erc20HasMore = erc20Data.result.length >= limit;
            } else {
                console.log(`[Etherscan] No more ERC20 transactions`);
            }
        } else {
            console.error(`[Etherscan Error] HTTP ${erc20Res.status}`);
        }

    } catch (err) {
        console.warn(`[Etherscan] Error fetching ${targetChain.label}:`, err);
    }

    const totalInserted = nativeInserted + erc20Inserted;
    console.log(`[Etherscan] ${targetChain.label} complete: ${totalInserted} inserted (Native: ${nativeInserted}, ERC20: ${erc20Inserted})`);

    return {
        chainId: targetChain.id,
        chainLabel: targetChain.label,
        nativeTxs: {
            inserted: nativeInserted,
            hasMore: nativeHasMore,
            nextPage: nativePage + 1
        },
        erc20Txs: {
            inserted: erc20Inserted,
            hasMore: erc20HasMore,
            nextPage: erc20Page + 1
        },
        totalInserted
    };
}

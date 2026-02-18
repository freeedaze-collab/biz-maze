// src/lib/incrementalWalletSync.ts
// Incremental wallet sync with chain-level pagination support
// Processes one chain at a time with pagination to avoid CPU timeouts

import { supabase } from '@/lib/supabaseClient';

const EVM_CHAINS = [
    { id: '0x1', label: 'Ethereum' },
    { id: '0x38', label: 'BNB Chain' },
    { id: '0x89', label: 'Polygon' },
    { id: '0xa4b1', label: 'Arbitrum' },
    { id: '0xa', label: 'Optimism' },
    { id: '0xa86a', label: 'Avalanche' },
    { id: '0x2105', label: 'Base' },
    { id: '0xfa', label: 'Fantom' },
];

export type SyncProgress = {
    walletAddress: string;
    currentWalletIndex: number;
    totalWallets: number;
    currentChain?: string;
    chainIndex?: number;
    totalChains?: number;
    transactionsSynced: number;
    status: 'syncing' | 'complete' | 'error';
    error?: string;
};

export async function syncAllWalletsIncremental(
    onProgress?: (progress: SyncProgress) => void
): Promise<{ success: boolean; totalSynced: number; errors: string[] }> {
    try {
        // Get user's wallets
        const { data: wallets, error: walletsError } = await supabase
            .from('wallet_connections')
            .select('wallet_address');

        if (walletsError) throw walletsError;
        if (!wallets || wallets.length === 0) {
            return { success: true, totalSynced: 0, errors: [] };
        }

        let totalSynced = 0;
        const errors: string[] = [];

        // Process each wallet
        for (let walletIdx = 0; walletIdx < wallets.length; walletIdx++) {
            const wallet = wallets[walletIdx];
            const walletAddress = wallet.wallet_address;

            console.log(`[Sync] Processing wallet ${walletIdx + 1}/${wallets.length}: ${walletAddress}`);

            // Process each chain for this wallet
            for (let chainIdx = 0; chainIdx < EVM_CHAINS.length; chainIdx++) {
                const chain = EVM_CHAINS[chainIdx];

                // Notify progress
                onProgress?.({
                    walletAddress,
                    currentWalletIndex: walletIdx + 1,
                    totalWallets: wallets.length,
                    currentChain: chain.label,
                    chainIndex: chainIdx + 1,
                    totalChains: EVM_CHAINS.length,
                    transactionsSynced: totalSynced,
                    status: 'syncing',
                });

                try {
                    // Fetch all pages for this chain
                    let nativePage = 1;
                    let erc20Page = 1;
                    let nativeHasMore = true;
                    let erc20HasMore = true;
                    let chainTotalSynced = 0;

                    // Keep fetching until both native and ERC20 are complete
                    while (nativeHasMore || erc20HasMore) {
                        const { data, error }: { data: any; error: any } = await supabase.functions.invoke(
                            'sync-wallet-transactions',
                            {
                                body: {
                                    walletAddress,
                                    chainId: chain.id,
                                    nativePage: nativeHasMore ? nativePage : 999999, // Skip if done
                                    erc20Page: erc20HasMore ? erc20Page : 999999,
                                },
                            }
                        );

                        if (error) {
                            console.error(`Error syncing ${chain.label} for wallet ${walletAddress}:`, error);
                            errors.push(`${walletAddress} - ${chain.label}: ${error.message}`);
                            break; // Move to next chain on error
                        }

                        if (data && data.success) {
                            const synced = data.totalInserted || 0;
                            chainTotalSynced += synced;
                            totalSynced += synced;

                            // Update pagination state
                            nativeHasMore = data.nativeTxs?.hasMore || false;
                            erc20HasMore = data.erc20Txs?.hasMore || false;
                            nativePage = data.nativeTxs?.nextPage || nativePage + 1;
                            erc20Page = data.erc20Txs?.nextPage || erc20Page + 1;

                            console.log(
                                `[${chain.label}] Page ${nativePage - 1}/${erc20Page - 1}: ` +
                                `${synced} txs (Native: ${nativeHasMore ? 'more' : 'done'}, ERC20: ${erc20HasMore ? 'more' : 'done'})`
                            );

                            // Update progress
                            onProgress?.({
                                walletAddress,
                                currentWalletIndex: walletIdx + 1,
                                totalWallets: wallets.length,
                                currentChain: chain.label,
                                chainIndex: chainIdx + 1,
                                totalChains: EVM_CHAINS.length,
                                transactionsSynced: totalSynced,
                                status: 'syncing',
                            });

                            // Small delay to avoid rate limits
                            await new Promise((resolve) => setTimeout(resolve, 300));
                        } else {
                            break; // No more data
                        }
                    }

                    console.log(`✓ Completed ${chain.label}: ${chainTotalSynced} transactions`);
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                    console.error(`Exception syncing ${chain.label} for wallet ${walletAddress}:`, err);
                    errors.push(`${walletAddress} - ${chain.label}: ${errorMsg}`);
                }

                // Delay between chains
                await new Promise((resolve) => setTimeout(resolve, 200));
            }

            console.log(`Completed wallet ${walletIdx + 1}/${wallets.length}`);
        }

        // Final progress update
        onProgress?.({
            walletAddress: 'All wallets',
            currentWalletIndex: wallets.length,
            totalWallets: wallets.length,
            transactionsSynced: totalSynced,
            status: 'complete',
        });

        return {
            success: errors.length === 0,
            totalSynced,
            errors,
        };
    } catch (error) {
        console.error('Incremental sync error:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        return {
            success: false,
            totalSynced: 0,
            errors: [errorMsg],
        };
    }
}

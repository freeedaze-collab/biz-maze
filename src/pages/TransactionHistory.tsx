
// app/routes/_protected.transaction-history/TransactionHistory.tsx
import React, { useState, useEffect } from 'react';
import { useOutletContext } from "@remix-run/react";
import { SupabaseClient } from "@supabase/supabase-js";
import ccxt from 'ccxt'; // ccxtをフロントエンドで直接利用
import SynthesisStatus from './SynthesisStatus'; // UIコンポーネント

interface ExchangeConnection {
    id: string;
    exchange: string;
    created_at: string;
}

// ★★★ 新アーキテクチャの心臓部 ★★★
export default function TransactionHistory() {
    const { supabase } = useOutletContext<{ supabase: SupabaseClient }>();
    const [connections, setConnections] = useState<ExchangeConnection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<Record<string, string>>({});
    const [totalSaved, setTotalSaved] = useState(0);

    useEffect(() => {
        const fetchConnections = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { setIsLoading(false); return; }

            const { data, error } = await supabase
                .from('exchange_connections')
                .select('id, exchange, created_at');

            if (error) {
                console.error("Error fetching connections:", error);
            } else {
                setConnections(data || []);
            }
            setIsLoading(false);
        };
        fetchConnections();
    }, [supabase]);

    const updateStatus = (exchange: string, message: string) => {
        setSyncStatus(prev => ({ ...prev, [exchange]: message }));
    };

    // フロントエンドで同期処理を実行するメイン関数
    const handleSync = async (exchange: string) => {
        updateStatus(exchange, 'Starting sync...');
        setTotalSaved(0);
        let decryptedKeys: any;

        try {
            // 1. バックエンドに復号化されたAPIキーをリクエスト
            updateStatus(exchange, 'Requesting secure keys...');
            const { data: keyData, error: keyError } = await supabase.functions.invoke('get-decrypted-keys', {
                body: { exchange },
            });
            if (keyError) throw new Error(`Failed to get keys: ${keyError.message}`);
            decryptedKeys = keyData;

            // 2. ブラウザ上でccxtインスタンスを作成
            updateStatus(exchange, 'Initializing CCXT...');
            // @ts-ignore
            const exchangeInstance = new ccxt[exchange]({
                apiKey: decryptedKeys.apiKey,
                secret: decryptedKeys.apiSecret,
                password: decryptedKeys.apiPassphrase,
            });

            const since = Date.now() - 90 * 24 * 60 * 60 * 1000;
            let allExchangeRecords: any[] = [];

            // 3. データを順番に取得 (タイムアウトの心配なし！)
            updateStatus(exchange, 'Loading markets...');
            await exchangeInstance.loadMarkets();

            updateStatus(exchange, 'Fetching balance...');
            const balance = await exchangeInstance.fetchBalance();
            const relevantAssets = new Set<string>(Object.keys(balance.total).filter(asset => balance.total[asset] > 0));

            if (exchangeInstance.has['fetchDeposits']) {
                updateStatus(exchange, 'Fetching deposits...');
                const deposits = await exchangeInstance.fetchDeposits(undefined, since);
                deposits.forEach(d => relevantAssets.add(d.currency));
                allExchangeRecords.push(...deposits);
            }

            if (exchangeInstance.has['fetchWithdrawals']) {
                updateStatus(exchange, 'Fetching withdrawals...');
                const withdrawals = await exchangeInstance.fetchWithdrawals(undefined, since);
                withdrawals.forEach(w => relevantAssets.add(w.currency));
                allExchangeRecords.push(...withdrawals);
            }
            
            if (exchangeInstance.has['fetchMyTrades']) {
                const marketsToCheck = new Set<string>();
                const quoteCurrencies = ['USDT', 'BTC', 'BUSD', 'USDC', 'JPY', 'ETH', 'BNB']; // 調査対象は柔軟に設定可能
                for (const asset of relevantAssets) {
                    for (const quote of quoteCurrencies) {
                        if (asset === quote) continue;
                        const symbol1 = `${asset}/${quote}`;
                        if (exchangeInstance.markets[symbol1]?.spot) marketsToCheck.add(symbol1);
                        const symbol2 = `${quote}/${asset}`;
                        if (exchangeInstance.markets[symbol2]?.spot) marketsToCheck.add(symbol2);
                    }
                }

                const symbols = Array.from(marketsToCheck);
                updateStatus(exchange, `Checking ${symbols.length} relevant markets for trades...`);

                for (let i = 0; i < symbols.length; i++) {
                    const symbol = symbols[i];
                    updateStatus(exchange, `[${i+1}/${symbols.length}] Fetching trades for ${symbol}...`);
                    try {
                      const trades = await exchangeInstance.fetchMyTrades(symbol, since);
                      if (trades.length > 0) {
                          allExchangeRecords.push(...trades);
                      }
                    } catch(e: any) {
                      console.warn(`Could not fetch trades for ${symbol}: ${e.message}`);
                    }
                }
            }

            updateStatus(exchange, `Found ${allExchangeRecords.length} total records. Preparing to save...`);

            // 4. 取得した全データをバックエンドに送信して保存
            if (allExchangeRecords.length > 0) {
                const { data: saveData, error: saveError } = await supabase.functions.invoke('save-records', {
                    body: { exchange, records: allExchangeRecords },
                });
                if (saveError) throw new Error(`Failed to save records: ${saveError.message}`);
                setTotalSaved(saveData.totalSaved || 0);
                updateStatus(exchange, `Sync complete! Saved ${saveData.totalSaved || 0} new records.`);
            } else {
                updateStatus(exchange, 'Sync complete! No new records found.');
            }

        } catch (error: any) {
            console.error("An error occurred during sync:", error);
            updateStatus(exchange, `Error: ${error.message}`);
        } finally {
            // ★ セキュリティ：処理完了後、キー情報を速やかに破棄
            decryptedKeys = null;
        }
    };

    const handleSyncAll = () => {
        // 全ての接続に対して同期処理を順番に実行
        connections.forEach(conn => handleSync(conn.exchange));
    };

    if (isLoading) {
        return <div>Loading connections...</div>;
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Transaction History</h1>
            
            <div className="mb-6">
                <button 
                    onClick={handleSyncAll}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
                    disabled={Object.values(syncStatus).some(s => s.includes('...'))}
                >
                    Sync All Exchanges
                </button>
            </div>

            <div className="space-y-4">
                {connections.map(conn => (
                    <div key={conn.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold">{conn.exchange}</h2>
                            <button 
                                onClick={() => handleSync(conn.exchange)}
                                className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded disabled:bg-gray-400"
                                disabled={Object.values(syncStatus).some(s => s.includes('...'))}
                            >
                                Sync
                            </button>
                        </div>
                        {syncStatus[conn.exchange] && (
                            <SynthesisStatus status={syncStatus[conn.exchange]} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

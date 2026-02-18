// src/lib/adapters/exchanges/BinanceAdapter.ts
// Adapter for Binance exchange

import { BaseExchangeAdapter } from '../base/BaseExchangeAdapter';
import { ExchangeCredentials, ExchangeFeatures } from '../types';

export class BinanceAdapter extends BaseExchangeAdapter {
    constructor() {
        super('binance');
    }

    /**
     * Test Binance API credentials
     */
    async testConnection(credentials: ExchangeCredentials): Promise<boolean> {
        try {
            const { apiKey, apiSecret } = credentials;

            if (!apiKey || !apiSecret) {
                throw new Error('API Key and Secret are required');
            }

            // Call backend proxy to test credentials
            // The backend handles the actual API call with proper signatures
            const { supabase } = await import('@/lib/supabaseClient');

            const { data, error } = await supabase.functions.invoke('exchange-binance-proxy', {
                body: {
                    apiKey,
                    apiSecret,
                    endpoint: '/api/v3/account',
                    method: 'GET'
                }
            });

            if (error) {
                console.error('Binance test connection failed:', error);
                return false;
            }

            return data?.ok === true || !!data?.balances;
        } catch (error) {
            console.error('Binance test connection error:', error);
            return false;
        }
    }

    /**
     * Get Binance supported features
     */
    getSupportedFeatures(): ExchangeFeatures {
        return {
            fetchTrades: true,
            fetchDeposits: true,
            fetchWithdrawals: true,
            fetchBalance: true,
            fetchFiatHistory: true, // Binance-specific
            fetchEarnHistory: true, // Binance-specific
            fetchConvertHistory: true, // Binance-specific
        };
    }
}

// src/lib/adapters/exchanges/CCXTExchangeAdapter.ts
// Generic adapter for CCXT-supported exchanges

import { BaseExchangeAdapter } from '../base/BaseExchangeAdapter';
import { ExchangeCredentials, ExchangeFeatures } from '../types';

export class CCXTExchangeAdapter extends BaseExchangeAdapter {
    private exchangeName: string;

    constructor(providerKey: string, exchangeName?: string) {
        super(providerKey);
        // Use provider key as exchange name if not specified
        this.exchangeName = exchangeName || providerKey;
    }

    /**
     * Test exchange API credentials via backend
     */
    async testConnection(credentials: ExchangeCredentials): Promise<boolean> {
        try {
            const { apiKey, apiSecret } = credentials;

            if (!apiKey || !apiSecret) {
                throw new Error('API Key and Secret are required');
            }

            // Call backend to test credentials using CCXT
            const { supabase } = await import('@/lib/supabaseClient');

            // We'll create a temporary connection to test
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Insert a test connection
            const { data: connection, error: insertError } = await supabase
                .from('exchange_connections')
                .insert({
                    user_id: user.id,
                    exchange: this.exchangeName,
                    connection_name: `Test-${Date.now()}`,
                    api_key_encrypted: apiKey,
                    api_secret_encrypted: apiSecret,
                    entity_id: null,
                    is_test: true
                })
                .select()
                .single();

            if (insertError || !connection) {
                console.error('Failed to create test connection:', insertError);
                return false;
            }

            // Try to fetch balance using this connection
            const { data, error } = await supabase.functions.invoke('exchange-sync-worker', {
                body: {
                    connection_id: connection.id,
                    task_type: 'balance'
                }
            });

            // Clean up test connection
            await supabase
                .from('exchange_connections')
                .delete()
                .eq('id', connection.id);

            if (error) {
                console.error(`${this.exchangeName} test connection failed:`, error);
                return false;
            }

            return !!data;
        } catch (error) {
            console.error(`${this.exchangeName} test connection error:`, error);
            return false;
        }
    }

    /**
     * Get exchange supported features
     * Default features - actual features depend on CCXT capabilities
     */
    getSupportedFeatures(): ExchangeFeatures {
        return {
            fetchTrades: true,
            fetchDeposits: true, // Most exchanges support this
            fetchWithdrawals: true, // Most exchanges support this
            fetchBalance: true,
        };
    }

    /**
     * Get the exchange name used in CCXT
     */
    getExchangeName(): string {
        return this.exchangeName;
    }
}

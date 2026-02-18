// src/lib/adapters/base/BaseExchangeAdapter.ts
// Abstract base class for all exchange adapters

import { supabase } from '@/lib/supabaseClient';
import {
    IExchangeAdapter,
    ExchangeCredentials,
    ExchangeFeatures,
    Trade,
    FetchTradesParams,
    SyncResult,
    ExchangeAdapterError
} from '../types';

export abstract class BaseExchangeAdapter implements IExchangeAdapter {
    protected providerKey: string;

    constructor(providerKey: string) {
        this.providerKey = providerKey;
    }

    /**
     * Abstract method to test connection with credentials
     */
    abstract testConnection(credentials: ExchangeCredentials): Promise<boolean>;

    /**
     * Abstract method to get supported features
     */
    abstract getSupportedFeatures(): ExchangeFeatures;

    /**
     * Sync all data for an exchange connection
     * Default implementation calls backend sync function
     */
    async syncData(connectionId: number): Promise<SyncResult> {
        try {
            const { data, error } = await supabase.functions.invoke('exchange-sync-all', {
                body: { connection_id: connectionId }
            });

            if (error) {
                throw new ExchangeAdapterError(
                    `Sync failed: ${error.message}`,
                    'SYNC_FAILED',
                    error
                );
            }

            return {
                success: true,
                count: data?.count || 0,
                message: data?.message || 'Sync completed successfully'
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Unknown sync error',
                message: error.message
            };
        }
    }

    /**
     * Fetch trades - default implementation throws error
     * Override if exchange supports direct API calls from frontend
     */
    async fetchTrades(
        credentials: ExchangeCredentials,
        params?: FetchTradesParams
    ): Promise<Trade[]> {
        throw new ExchangeAdapterError(
            'Direct trade fetching not implemented. Use syncData() instead.',
            'NOT_IMPLEMENTED'
        );
    }

    /**
     * Get the provider key from configuration
     */
    getProviderKey(): string {
        return this.providerKey;
    }

    /**
     * Utility method to handle errors consistently
     */
    protected handleError(error: any, context: string): never {
        if (error instanceof ExchangeAdapterError) {
            throw error;
        }

        const message = error?.message || 'Unknown error occurred';
        const code = error?.code || 'UNKNOWN_ERROR';

        throw new ExchangeAdapterError(
            `${context}: ${message}`,
            code,
            error
        );
    }

    /**
     * Wait with exponential backoff for rate limiting
     */
    protected async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retry logic for API calls
     */
    protected async retry<T>(
        fn: () => Promise<T>,
        maxRetries: number = 3,
        delayMs: number = 1000
    ): Promise<T> {
        let lastError: any;

        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (i < maxRetries - 1) {
                    await this.sleep(delayMs * Math.pow(2, i)); // Exponential backoff
                }
            }
        }

        throw lastError;
    }
}

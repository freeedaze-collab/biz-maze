// src/lib/adapters/base/BaseWalletAdapter.ts
// Abstract base class for all wallet adapters

import { IWalletAdapter, WalletConnection, WalletBalance, WalletAdapterError } from '../types';

export abstract class BaseWalletAdapter implements IWalletAdapter {
    protected providerKey: string;
    protected connection: WalletConnection | null = null;

    constructor(providerKey: string) {
        this.providerKey = providerKey;
    }

    /**
     * Abstract method to be implemented by specific wallet adapters
     */
    abstract connect(): Promise<WalletConnection>;

    /**
     * Abstract method to be implemented by specific wallet adapters
     */
    abstract signMessage(message: string): Promise<string>;

    /**
     * Abstract method to be implemented by specific wallet adapters
     */
    abstract isDetected(): boolean;

    /**
     * Get wallet balance
     * Default implementation - override if wallet has specific balance retrieval
     */
    async getBalance(): Promise<WalletBalance> {
        if (!this.connection) {
            throw new WalletAdapterError('Wallet not connected', 'NOT_CONNECTED');
        }

        // Default implementation returns 0 - subclasses should override
        return {
            balance: '0',
            decimals: 18,
            symbol: 'Unknown',
        };
    }

    /**
     * Disconnect from wallet
     */
    async disconnect(): Promise<void> {
        this.connection = null;
    }

    /**
     * Get the provider key from configuration
     */
    getProviderKey(): string {
        return this.providerKey;
    }

    /**
     * Get current connection state
     */
    getConnection(): WalletConnection | null {
        return this.connection;
    }

    /**
     * Check if wallet is currently connected
     */
    isConnected(): boolean {
        return this.connection !== null;
    }

    /**
     * Utility method to handle errors consistently
     */
    protected handleError(error: any, context: string): never {
        if (error instanceof WalletAdapterError) {
            throw error;
        }

        const message = error?.message || 'Unknown error occurred';
        const code = error?.code || 'UNKNOWN_ERROR';

        throw new WalletAdapterError(
            `${context}: ${message}`,
            code,
            error
        );
    }
}

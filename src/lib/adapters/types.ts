// src/lib/adapters/types.ts
// Core types and interfaces for wallet and exchange adapters

// ============================================================================
// Wallet Adapter Types
// ============================================================================

export interface WalletConnection {
    address: string;
    chainId?: string;
    chainType: 'evm' | 'bitcoin' | 'solana';
    provider?: any; // Provider instance (e.g., window.ethereum)
}

export interface WalletBalance {
    balance: string;
    decimals: number;
    symbol: string;
}

export interface IWalletAdapter {
    /**
     * Connect to the wallet and return connection details
     */
    connect(): Promise<WalletConnection>;

    /**
     * Disconnect from the wallet
     */
    disconnect(): Promise<void>;

    /**
     * Sign a message with the wallet
     * @param message - Message to sign (string or bytes)
     */
    signMessage(message: string): Promise<string>;

    /**
     * Get the wallet balance
     */
    getBalance(): Promise<WalletBalance>;

    /**
     * Check if the wallet is detected/installed
     */
    isDetected(): boolean;

    /**
     * Get the wallet provider key from configuration
     */
    getProviderKey(): string;
}

// ============================================================================
// Exchange Adapter Types
// ============================================================================

export interface ExchangeCredentials {
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    uid?: string;
    [key: string]: any;
}

export interface ExchangeBalance {
    currency: string;
    free: number;
    used: number;
    total: number;
}

export interface Trade {
    id: string;
    timestamp: number;
    datetime: string;
    symbol: string;
    type: 'limit' | 'market';
    side: 'buy' | 'sell';
    price: number;
    amount: number;
    cost: number;
    fee?: {
        cost: number;
        currency: string;
    };
}

export interface FetchTradesParams {
    symbol?: string;
    since?: number;
    limit?: number;
}

export interface ExchangeFeatures {
    fetchTrades: boolean;
    fetchDeposits: boolean;
    fetchWithdrawals: boolean;
    fetchBalance: boolean;
    [key: string]: boolean;
}

export interface SyncResult {
    success: boolean;
    count?: number;
    message?: string;
    error?: string;
}

export interface IExchangeAdapter {
    /**
     * Test if the provided credentials are valid
     */
    testConnection(credentials: ExchangeCredentials): Promise<boolean>;

    /**
     * Trigger a full sync of exchange data (trades, deposits, withdrawals)
     * @param connectionId - Database ID of the exchange connection
     */
    syncData(connectionId: number): Promise<SyncResult>;

    /**
     * Fetch trades for a specific symbol or all symbols
     */
    fetchTrades(credentials: ExchangeCredentials, params?: FetchTradesParams): Promise<Trade[]>;

    /**
     * Get the features supported by this exchange
     */
    getSupportedFeatures(): ExchangeFeatures;

    /**
     * Get the exchange provider key from configuration
     */
    getProviderKey(): string;
}

// ============================================================================
// Common Types
// ============================================================================

export type ChainType = 'evm' | 'bitcoin' | 'solana';

export interface AdapterError extends Error {
    code?: string;
    details?: any;
}

export class WalletAdapterError extends Error implements AdapterError {
    code?: string;
    details?: any;

    constructor(message: string, code?: string, details?: any) {
        super(message);
        this.name = 'WalletAdapterError';
        this.code = code;
        this.details = details;
    }
}

export class ExchangeAdapterError extends Error implements AdapterError {
    code?: string;
    details?: any;

    constructor(message: string, code?: string, details?: any) {
        super(message);
        this.name = 'ExchangeAdapterError';
        this.code = code;
        this.details = details;
    }
}

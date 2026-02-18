import { IWalletAdapter, IExchangeAdapter } from './types';
import { EVMWalletAdapter } from './wallets/EVMWalletAdapter';
import { PhantomAdapter } from './wallets/PhantomAdapter';
import { WalletConnectAdapter } from './wallets/WalletConnectAdapter';
import { BinanceAdapter } from './exchanges/BinanceAdapter';
import { CCXTExchangeAdapter } from './exchanges/CCXTExchangeAdapter';
import { UniSatAdapter } from './wallets/UniSatAdapter';
import { WALLET_PROVIDERS, EXCHANGES } from '@/config/providers';
import { getExchangeBySlug } from '@/config/exchangeCatalog';

/**
 * Adapter Registry for wallets and exchanges
 */
export class AdapterRegistry {
    /**
     * Get wallet adapter for a given provider key
     */
    static getWalletAdapter(walletKey: string, provider?: any): IWalletAdapter {
        const walletConfig = (WALLET_PROVIDERS as Record<string, any>)[walletKey];

        if (!walletConfig) {
            throw new Error(`Unknown wallet provider: ${walletKey}`);
        }

        // Special cases for specific wallets
        switch (walletKey) {
            case 'phantom':
                // Phantom Solana
                return new PhantomAdapter(walletKey, 'solana');

            case 'phantom-bitcoin':
                // Phantom Bitcoin
                return new PhantomAdapter(walletKey, 'bitcoin');

            case 'walletconnect':
                return new WalletConnectAdapter(walletKey);

            case 'unisat':
                return new UniSatAdapter();

            default:
                // Default to EVM wallet adapter for all other wallets
                return new EVMWalletAdapter(walletKey, provider);
        }
    }

    /**
     * Get exchange adapter for a given provider key.
     * Supports ANY CCXT slug — not limited to the hardcoded EXCHANGES config.
     */
    static getExchangeAdapter(exchangeKey: string): IExchangeAdapter {
        // Special cases first
        if (exchangeKey === 'binance') {
            return new BinanceAdapter();
        }

        // Check hardcoded config for slug mapping
        const hardcodedConfig = (EXCHANGES as Record<string, any>)[exchangeKey];
        if (hardcodedConfig) {
            return new CCXTExchangeAdapter(exchangeKey, hardcodedConfig.slug);
        }

        // Check the extended catalog
        const catalogEntry = getExchangeBySlug(exchangeKey);
        if (catalogEntry) {
            return new CCXTExchangeAdapter(exchangeKey, catalogEntry.slug);
        }

        // Fallback: try slug directly (backend CCXT will validate)
        return new CCXTExchangeAdapter(exchangeKey, exchangeKey);
    }

    /**
     * Check if a wallet provider is supported
     */
    static isWalletSupported(walletKey: string): boolean {
        return !!(WALLET_PROVIDERS as Record<string, any>)[walletKey];
    }

    /**
     * Check if an exchange provider is supported
     */
    static isExchangeSupported(exchangeKey: string): boolean {
        return !!(EXCHANGES as Record<string, any>)[exchangeKey];
    }

    /**
     * Get all available wallet adapters that are detected
     */
    static getDetectedWallets(): Array<{ key: string; adapter: IWalletAdapter }> {
        const detected: Array<{ key: string; adapter: IWalletAdapter }> = [];

        for (const [key, config] of Object.entries(WALLET_PROVIDERS)) {
            if (!config.enabled) continue;

            try {
                const adapter = this.getWalletAdapter(key);
                if (adapter.isDetected()) {
                    detected.push({ key, adapter });
                }
            } catch (error) {
                console.warn(`Failed to check wallet ${key}:`, error);
            }
        }

        return detected;
    }
}

// Export singleton instance
export default AdapterRegistry;

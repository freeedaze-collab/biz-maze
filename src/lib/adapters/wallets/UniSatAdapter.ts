// src/lib/adapters/wallets/UniSatAdapter.ts
// Adapter for UniSat Bitcoin wallet

import { BaseWalletAdapter } from '../base/BaseWalletAdapter';
import { WalletConnection, WalletBalance, WalletAdapterError } from '../types';

export class UniSatAdapter extends BaseWalletAdapter {
    constructor(providerKey: string = 'unisat') {
        super(providerKey);
    }

    /**
     * Check if UniSat wallet is detected
     */
    isDetected(): boolean {
        return typeof window !== 'undefined' && !!(window as any).unisat;
    }

    /**
     * Connect to UniSat wallet
     */
    async connect(): Promise<WalletConnection> {
        try {
            if (!this.isDetected()) {
                throw new WalletAdapterError(
                    'UniSat wallet not detected. Please install UniSat extension.',
                    'WALLET_NOT_DETECTED'
                );
            }

            const unisat = (window as any).unisat;

            // Request accounts
            const accounts = await unisat.requestAccounts();

            if (!accounts || accounts.length === 0) {
                throw new WalletAdapterError(
                    'No Bitcoin accounts found in UniSat.',
                    'NO_ACCOUNTS'
                );
            }

            this.connection = {
                address: accounts[0],
                chainType: 'bitcoin',
                provider: unisat
            };

            // Listen for account changes
            unisat.on?.('accountsChanged', (accounts: string[]) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else if (this.connection) {
                    this.connection.address = accounts[0];
                }
            });

            return this.connection;
        } catch (error: any) {
            this.handleError(error, 'UniSat connection failed');
        }
    }

    /**
     * Sign a message with UniSat
     */
    async signMessage(message: string): Promise<string> {
        try {
            if (!this.connection) {
                throw new WalletAdapterError('Wallet not connected', 'NOT_CONNECTED');
            }

            const unisat = this.connection.provider;

            // UniSat signMessage
            // Returns base64 signature
            const signature = await unisat.signMessage(message);

            return signature;
        } catch (error: any) {
            this.handleError(error, 'Message signing failed');
        }
    }

    /**
     * Get balance ( UniSat special API )
     */
    async getBalance(): Promise<WalletBalance> {
        try {
            if (!this.connection) {
                throw new WalletAdapterError('Wallet not connected', 'NOT_CONNECTED');
            }

            const unisat = this.connection.provider;
            const res = await unisat.getBalance();

            return {
                balance: res.total.toString(),
                decimals: 8,
                symbol: 'BTC'
            };
        } catch (error: any) {
            this.handleError(error, 'Balance fetch failed');
        }
    }

    /**
     * Disconnect
     */
    async disconnect(): Promise<void> {
        if (this.connection?.provider) {
            this.connection.provider.removeAllListeners?.('accountsChanged');
        }
        await super.disconnect();
    }
}

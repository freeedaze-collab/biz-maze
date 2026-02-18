// src/lib/adapters/wallets/WalletConnectAdapter.ts
// Adapter for WalletConnect v2

import { BaseWalletAdapter } from '../base/BaseWalletAdapter';
import { WalletConnection, WalletBalance, WalletAdapterError } from '../types';
import { createWCProvider, WCProvider } from '@/lib/walletconnect';

export class WalletConnectAdapter extends BaseWalletAdapter {
    private wcProvider: WCProvider | null = null;

    constructor(providerKey: string = 'walletconnect') {
        super(providerKey);
    }

    /**
     * WalletConnect is always "detected" since it doesn't require installation
     */
    isDetected(): boolean {
        return true;
    }

    /**
     * Connect via WalletConnect (shows QR modal)
     */
    async connect(): Promise<WalletConnection> {
        try {
            // Create WalletConnect provider
            this.wcProvider = await createWCProvider();

            // Enable connection (shows QR modal)
            if (this.wcProvider.connect) {
                await this.wcProvider.connect();
            }

            // Request accounts
            const accounts = await this.wcProvider.request({
                method: 'eth_requestAccounts'
            });

            if (!accounts || accounts.length === 0) {
                throw new WalletAdapterError(
                    'No accounts found from WalletConnect',
                    'NO_ACCOUNTS'
                );
            }

            // Get chain ID
            const chainId = await this.wcProvider.request({
                method: 'eth_chainId'
            });

            this.connection = {
                address: accounts[0],
                chainId: chainId,
                chainType: 'evm',
                provider: this.wcProvider
            };

            return this.connection;
        } catch (error: any) {
            if (error.message?.includes('User rejected')) {
                throw new WalletAdapterError(
                    'User rejected the connection request',
                    'USER_REJECTED'
                );
            }
            this.handleError(error, 'WalletConnect connection failed');
        }
    }

    /**
     * Sign a message with WalletConnect
     */
    async signMessage(message: string): Promise<string> {
        try {
            if (!this.connection || !this.wcProvider) {
                throw new WalletAdapterError('WalletConnect not connected', 'NOT_CONNECTED');
            }

            const signature = await this.wcProvider.request({
                method: 'personal_sign',
                params: [message, this.connection.address]
            });

            return signature;
        } catch (error: any) {
            this.handleError(error, 'Message signing failed');
        }
    }

    /**
     * Get wallet balance
     */
    async getBalance(): Promise<WalletBalance> {
        try {
            if (!this.connection || !this.wcProvider) {
                throw new WalletAdapterError('WalletConnect not connected', 'NOT_CONNECTED');
            }

            const balance = await this.wcProvider.request({
                method: 'eth_getBalance',
                params: [this.connection.address, 'latest']
            });

            return {
                balance: balance,
                decimals: 18,
                symbol: 'ETH'
            };
        } catch (error: any) {
            this.handleError(error, 'Balance fetch failed');
        }
    }

    /**
     * Disconnect from WalletConnect
     */
    async disconnect(): Promise<void> {
        if (this.wcProvider?.disconnect) {
            try {
                await this.wcProvider.disconnect();
            } catch (error) {
                console.warn('WalletConnect disconnect error:', error);
            }
        }

        this.wcProvider = null;
        await super.disconnect();
    }
}

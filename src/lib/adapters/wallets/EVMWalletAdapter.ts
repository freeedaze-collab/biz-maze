// src/lib/adapters/wallets/EVMWalletAdapter.ts
// Generic adapter for EIP-6963 compliant EVM wallets (MetaMask, Coinbase Wallet, etc.)

import { BaseWalletAdapter } from '../base/BaseWalletAdapter';
import { WalletConnection, WalletBalance, WalletAdapterError } from '../types';

function stringToHex(str: string): string {
    let hex = '0x';
    for (let i = 0; i < str.length; i++) {
        hex += str.charCodeAt(i).toString(16);
    }
    return hex;
}

export class EVMWalletAdapter extends BaseWalletAdapter {
    private provider: any;

    constructor(providerKey: string, provider?: any) {
        super(providerKey);
        this.provider = provider;
    }

    /**
     * Check if an EVM wallet is detected
     */
    isDetected(): boolean {
        if (this.provider) {
            return true;
        }

        // Check for window.ethereum as fallback
        return typeof window !== 'undefined' && !!window.ethereum;
    }

    /**
     * Connect to the EVM wallet
     */
    async connect(): Promise<WalletConnection> {
        try {
            if (!this.isDetected()) {
                throw new WalletAdapterError(
                    'EVM wallet not detected. Please install a wallet extension.',
                    'WALLET_NOT_DETECTED'
                );
            }

            // Use provided provider or fallback to window.ethereum
            const provider = this.provider || window.ethereum;

            // Request account access
            const accounts = await provider.request({
                method: 'eth_requestAccounts'
            });

            if (!accounts || accounts.length === 0) {
                throw new WalletAdapterError(
                    'No accounts found. Please unlock your wallet.',
                    'NO_ACCOUNTS'
                );
            }

            // Get chain ID
            const chainId = await provider.request({
                method: 'eth_chainId'
            });

            this.connection = {
                address: accounts[0],
                chainId: chainId,
                chainType: 'evm',
                provider: provider
            };

            // Listen for account changes
            provider.on?.('accountsChanged', (accounts: string[]) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else if (this.connection) {
                    this.connection.address = accounts[0];
                }
            });

            // Listen for chain changes
            provider.on?.('chainChanged', (chainId: string) => {
                if (this.connection) {
                    this.connection.chainId = chainId;
                }
            });

            return this.connection;
        } catch (error: any) {
            this.handleError(error, 'EVM wallet connection failed');
        }
    }

    /**
     * Sign a message with the connected wallet
     */
    async signMessage(message: string): Promise<string> {
        try {
            if (!this.connection) {
                throw new WalletAdapterError('Wallet not connected', 'NOT_CONNECTED');
            }

            const provider = this.connection.provider;
            const address = this.connection.address;

            // Hex encode the message for personal_sign using internal helper
            // This avoids external dependencies like viem that might cause bundling issues
            const hexMessage = stringToHex(message);

            // Sign the message using personal_sign
            const signature = await provider.request({
                method: 'personal_sign',
                params: [hexMessage, address]
            });

            return signature;
        } catch (error: any) {
            console.error('Sign error:', error);
            this.handleError(error, 'Message signing failed');
            throw error;
        }
    }

    /**
     * Get wallet balance
     */
    async getBalance(): Promise<WalletBalance> {
        try {
            if (!this.connection) {
                throw new WalletAdapterError('Wallet not connected', 'NOT_CONNECTED');
            }

            const provider = this.connection.provider;
            const address = this.connection.address;

            const balance = await provider.request({
                method: 'eth_getBalance',
                params: [address, 'latest']
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
     * Disconnect from the wallet
     */
    async disconnect(): Promise<void> {
        if (this.connection?.provider) {
            // Remove event listeners if possible
            this.connection.provider.removeAllListeners?.('accountsChanged');
            this.connection.provider.removeAllListeners?.('chainChanged');
        }

        await super.disconnect();
    }

    /**
     * Switch to a specific chain
     */
    async switchChain(chainId: string): Promise<void> {
        try {
            if (!this.connection) {
                throw new WalletAdapterError('Wallet not connected', 'NOT_CONNECTED');
            }

            await this.connection.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }]
            });

            this.connection.chainId = chainId;
        } catch (error: any) {
            // If chain doesn't exist, this will fail with error code 4902
            this.handleError(error, 'Chain switch failed');
        }
    }
}

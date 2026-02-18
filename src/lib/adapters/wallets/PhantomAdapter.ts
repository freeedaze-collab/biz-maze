// src/lib/adapters/wallets/PhantomAdapter.ts
// Adapter for Phantom wallet supporting both Solana and Bitcoin

import { BaseWalletAdapter } from '../base/BaseWalletAdapter';
import { WalletConnection, WalletBalance, WalletAdapterError } from '../types';

type PhantomChainType = 'solana' | 'bitcoin';

export class PhantomAdapter extends BaseWalletAdapter {
    private chainType: PhantomChainType;

    constructor(providerKey: string, chainType: PhantomChainType = 'solana') {
        super(providerKey);
        this.chainType = chainType;
    }

    /**
     * Check if Phantom wallet is detected for the specific chain
     */
    isDetected(): boolean {
        if (typeof window === 'undefined') return false;

        const phantom = (window as any).phantom;

        if (!phantom) return false;

        if (this.chainType === 'solana') {
            return !!phantom.solana;
        } else if (this.chainType === 'bitcoin') {
            return !!phantom.bitcoin;
        }

        return false;
    }

    /**
     * Connect to Phantom wallet
     */
    async connect(): Promise<WalletConnection> {
        try {
            if (!this.isDetected()) {
                throw new WalletAdapterError(
                    `Phantom ${this.chainType} not detected. Please install Phantom wallet.`,
                    'WALLET_NOT_DETECTED'
                );
            }

            const phantom = (window as any).phantom;
            const provider = this.chainType === 'solana' ? phantom.solana : phantom.bitcoin;

            // Connect to the wallet
            const response = await provider.connect();

            let address: string;

            if (this.chainType === 'solana') {
                // Solana returns publicKey
                address = response.publicKey.toString();
            } else {
                // Bitcoin returns address or addresses array
                address = response.address || response.addresses?.[0];

                if (!address) {
                    throw new WalletAdapterError(
                        'No Bitcoin address found',
                        'NO_ADDRESS'
                    );
                }
            }

            this.connection = {
                address,
                chainType: this.chainType === 'solana' ? 'solana' : 'bitcoin',
                provider: provider
            };

            // Listen for account changes
            provider.on?.('accountChanged', (publicKey: any) => {
                if (!publicKey) {
                    this.disconnect();
                } else if (this.connection) {
                    this.connection.address = publicKey.toString();
                }
            });

            // Listen for disconnect
            provider.on?.('disconnect', () => {
                this.disconnect();
            });

            return this.connection;
        } catch (error: any) {
            // Handle user rejection
            if (error.code === 4001) {
                throw new WalletAdapterError(
                    'User rejected the connection request',
                    'USER_REJECTED'
                );
            }
            this.handleError(error, `Phantom ${this.chainType} connection failed`);
        }
    }

    /**
     * Sign a message with Phantom
     */
    async signMessage(message: string): Promise<string> {
        try {
            if (!this.connection) {
                throw new WalletAdapterError('Wallet not connected', 'NOT_CONNECTED');
            }

            const provider = this.connection.provider;

            if (this.chainType === 'solana') {
                // Solana signing
                const encodedMessage = new TextEncoder().encode(message);
                const { signature } = await provider.signMessage(encodedMessage, 'utf8');

                // Convert signature to hex string
                return Buffer.from(signature).toString('hex');
            } else {
                // Bitcoin signing
                const response = await provider.signMessage(
                    this.connection.address,
                    message
                );

                return response.signature;
            }
        } catch (error: any) {
            this.handleError(error, 'Message signing failed');
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

            // Phantom doesn't provide direct balance API
            // For now, return placeholder - balance fetching would require RPC calls
            return {
                balance: '0',
                decimals: this.chainType === 'solana' ? 9 : 8,
                symbol: this.chainType === 'solana' ? 'SOL' : 'BTC'
            };
        } catch (error: any) {
            this.handleError(error, 'Balance fetch failed');
        }
    }

    /**
     * Disconnect from Phantom
     */
    async disconnect(): Promise<void> {
        if (this.connection?.provider) {
            try {
                await this.connection.provider.disconnect();
            } catch (error) {
                // Ignore disconnect errors
                console.warn('Phantom disconnect error:', error);
            }

            // Remove event listeners
            this.connection.provider.removeAllListeners?.('accountChanged');
            this.connection.provider.removeAllListeners?.('disconnect');
        }

        await super.disconnect();
    }

    /**
     * Get the chain type for this adapter instance
     */
    getChainType(): PhantomChainType {
        return this.chainType;
    }
}

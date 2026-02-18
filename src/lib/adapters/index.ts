// src/lib/adapters/index.ts
// Main export file for all adapters

// Types
export * from './types';

// Base classes
export { BaseWalletAdapter } from './base/BaseWalletAdapter';
export { BaseExchangeAdapter } from './base/BaseExchangeAdapter';

// Wallet adapters
export { EVMWalletAdapter } from './wallets/EVMWalletAdapter';
export { PhantomAdapter } from './wallets/PhantomAdapter';
export { WalletConnectAdapter } from './wallets/WalletConnectAdapter';

// Exchange adapters
export { BinanceAdapter } from './exchanges/BinanceAdapter';
export { CCXTExchangeAdapter } from './exchanges/CCXTExchangeAdapter';

// Registry
export { AdapterRegistry } from './registry';
export { default } from './registry';

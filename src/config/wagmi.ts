import { createConfig, http } from 'wagmi';
import { mainnet, polygon } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// Configure supported chains
export const config = createConfig({
  chains: [mainnet, polygon],
  connectors: [
    injected(),
    walletConnect({
      projectId: 'your-project-id', // Replace with actual WalletConnect project ID
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
  },
});

export const SUPPORTED_CHAINS = {
  [mainnet.id]: {
    name: 'ethereum',
    nativeSymbol: 'ETH',
    chainConfig: mainnet,
  },
  [polygon.id]: {
    name: 'polygon',
    nativeSymbol: 'MATIC',
    chainConfig: polygon,
  },
} as const;
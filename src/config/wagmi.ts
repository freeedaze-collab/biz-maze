import { http, createConfig } from 'wagmi';
import { polygon } from 'wagmi/chains';

// Polygon優先
export const SUPPORTED_CHAINS = [polygon];
export const DEFAULT_CHAIN = polygon;

const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;

// wagmi設定（Polygon）
export const wagmiConfig = createConfig({
  chains: SUPPORTED_CHAINS,
  transports: {
    [polygon.id]: http(
      ALCHEMY_KEY
        ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
        : undefined
    ),
  },
  ssr: false,
});

// WETH（Polygon）定義（18 decimals, ERC-20）
export const WETH_POLYGON = {
  type: 'erc20' as const,
  contract: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as `0x${string}`,
  symbol: 'WETH',
  decimals: 18,
  chainId: polygon.id,
};

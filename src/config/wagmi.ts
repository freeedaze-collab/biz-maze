// src/config/wagmi.ts
import { http, createConfig } from 'wagmi'
import { polygon, polygonAmoy, mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { walletConnect } from 'wagmi/connectors'
import { createPublicClient } from 'viem'
import { defineChain } from 'viem'

const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined

// 必要に応じて mainnet/polygonAmoy も有効化可能
const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID ?? polygon.id)

const CHAIN_MAP: Record<number, typeof polygon> = {
  [polygon.id]: polygon,
  [polygonAmoy.id]: polygonAmoy,
  [mainnet.id]: mainnet,
}

export const DEFAULT_CHAIN = CHAIN_MAP[DEFAULT_CHAIN_ID] ?? polygon

export const wagmiConfig = createConfig({
  chains: [DEFAULT_CHAIN, polygon, polygonAmoy, mainnet],
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string,
      showQrModal: true,
    }),
  ],
  transports: {
    [polygon.id]: http(ALCHEMY_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : undefined),
    [polygonAmoy.id]: http(),
    [mainnet.id]: http(ALCHEMY_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : undefined),
  },
})

export const publicClient = createPublicClient({
  chain: DEFAULT_CHAIN,
  transport: http(),
})

// src/config/wagmi.ts
import { http, createConfig } from 'wagmi'
import { polygon, polygonAmoy, mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { walletConnect } from 'wagmi/connectors'
import { createPublicClient } from 'viem'
import { defineChain } from 'viem'

const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined

// デフォルトチェーンを環境変数から選択
const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID ?? polygon.id)

const ALL_CHAINS = [polygon, polygonAmoy, mainnet] as const

export const DEFAULT_CHAIN = ALL_CHAINS.find(c => c.id === DEFAULT_CHAIN_ID) ?? polygon

export const wagmiConfig = createConfig({
  chains: ALL_CHAINS,
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

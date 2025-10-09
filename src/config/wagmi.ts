// src/config/wagmi.ts
import { createConfig, http } from 'wagmi'
import { mainnet, polygon, polygonAmoy } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { createPublicClient } from 'viem'

const ALCHEMY_KEY = import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined

// 実行中のオリジン（WalletConnect metadata 用）
const ORIGIN =
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
const APP_METADATA = {
  name: 'Biz Maze',
  description: 'Biz Maze dApp',
  url: ORIGIN,
  icons: [`${ORIGIN}/favicon.ico`],
}

// 既定チェーン（polygon を既定に）
const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID ?? polygon.id)
const ALL_CHAINS = [polygon, polygonAmoy, mainnet] as const
export const DEFAULT_CHAIN =
  ALL_CHAINS.find((c) => c.id === DEFAULT_CHAIN_ID) ?? polygon

export const wagmiConfig = createConfig({
  chains: ALL_CHAINS,
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID ?? '',
      metadata: APP_METADATA,
      showQrModal: true,
    }),
  ],
  transports: {
    [polygon.id]: http(
      ALCHEMY_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : undefined
    ),
    [polygonAmoy.id]: http(), // 必要なら Alchemy/Infura に差し替え
    [mainnet.id]: http(
      ALCHEMY_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : undefined
    ),
  },
})

export const publicClient = createPublicClient({
  chain: DEFAULT_CHAIN,
  transport: http(),
})

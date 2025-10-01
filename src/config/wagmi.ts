// src/config/wagmi.ts
import { http, createConfig } from 'wagmi'
import { polygon, polygonAmoy, mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { walletConnect } from 'wagmi/connectors'

const ALCHEMY_KEY = (import.meta.env.VITE_ALCHEMY_API_KEY ?? '').trim()
const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID ?? polygon.id)
const WC_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '').trim()
const WC_ALLOWED = (import.meta.env.VITE_WC_ALLOWED_ORIGINS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)
const WC_DISABLE = String(import.meta.env.VITE_WC_DISABLE ?? '').toLowerCase()

const chains = [polygon, polygonAmoy, mainnet]
const transports = {
  [polygon.id]: http(ALCHEMY_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : undefined),
  [polygonAmoy.id]: http(),
  [mainnet.id]: http(ALCHEMY_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : undefined),
} as const

function wcEnabled() {
  if (WC_DISABLE === '1' || WC_DISABLE === 'true') return { enabled: false, reason: 'disabled-by-env' }
  if (!WC_PROJECT_ID) return { enabled: false, reason: 'no-project-id' }
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  if (WC_ALLOWED.length && !WC_ALLOWED.some(a => origin.includes(a))) {
    return { enabled: false, reason: `origin-not-allowed:${origin}` }
  }
  return { enabled: true, reason: 'ok' }
}

const wc = wcEnabled()
if (typeof window !== 'undefined') {
  console.info('[wagmi] walletconnect enabled:', wc.enabled, wc.reason)
}

const connectors = [
  injected({ shimDisconnect: true }),
  ...(wc.enabled ? [walletConnect({ projectId: WC_PROJECT_ID, showQrModal: true })] : []),
]

export const wagmiConfig = createConfig({
  chains,
  connectors,
  transports,
})

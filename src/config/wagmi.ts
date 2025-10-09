// src/config/wagmi.ts
import { createConfig, http } from 'wagmi'
import { mainnet, polygon, arbitrum, base } from 'wagmi/chains'

// 必要なチェーンだけ残してOK（まずは ETH メイン網のみでも可）
const chains = [mainnet]

export const wagmiConfig = createConfig({
  chains,
  // wagmi v2 では connector は 'wagmi/connectors' から。
  // 個別ファイル('wagmi/connectors/injected')は NG です。
  connectors: [], // ← 明示的に書かなくても injected は useConnect 側で指定可
  transports: {
    [mainnet.id]: http(),        // 環境変数の RPC を使いたければ http(import.meta.env.VITE_ETH_RPC_URL)
  },
})

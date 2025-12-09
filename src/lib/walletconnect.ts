// src/lib/walletconnect.ts
// ESM 版 WalletConnect v2。UMD/CDN は使わず、ビルドに完全同梱。
// MetaMask 拡張なし（モバイル含む）でも QR モーダルで接続可能。

export type WCProvider = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

import EthereumProvider from '@walletconnect/ethereum-provider';

// 利用チェーン：必須の chains（最低1つ）。optionalChains は広めに入れておくと互換性◎
const REQUIRED_CHAINS = [1]; // Ethereum Mainnet
const OPTIONAL_CHAINS = [
  1,      // Ethereum
  137,    // Polygon
  56,     // BNB
  8453,   // Base
  42161,  // Arbitrum
  10,     // Optimism
  43114,  // Avalanche
  324,    // zkSync
];

let loaded = false;

async function ensureLoaded() {
  if (loaded) return;
  // ESM なので特にやることなし（同一バンドル内）
  loaded = true;
}

export async function createWCProvider(): Promise<WCProvider> {
  await ensureLoaded();

  const projectId = (import.meta as any).env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("VITE_WC_PROJECT_ID is missing");

  const provider: WCProvider = await EthereumProvider.init({
    projectId,
    showQrModal: true,             // connect() 時にQRモーダル表示
    chains: REQUIRED_CHAINS,       // ←必須
    optionalChains: OPTIONAL_CHAINS,
    optionalMethods: [
      'eth_requestAccounts',
      'personal_sign',
      'eth_signTypedData',
      'eth_signTypedData_v4',
    ],
    metadata: {
      name: "BizMaze Wallet Link",
      description: "Link your wallet",
      url: location.origin,
      icons: ["https://walletconnect.com/_next/static/media/logo.9f0f5e70.svg"],
    },
    // 必要なら relayUrl/qrModalOptions など追加可能
  });

  return provider;
}

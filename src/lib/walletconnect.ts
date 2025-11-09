// src/lib/walletconnect.ts
// WalletConnect v2 を ESM でバンドル（UMD/CDN/グローバル不要）
// - Vite が依存を同梱
// - モーダルのCSSもESMで読み込む

import type { EthereumProviderOptions } from "@walletconnect/ethereum-provider";

// ※ modalのCSSは package 側のCSSを直接 import（Vite で同梱される）
import "@walletconnect/modal/dist/style.css";

export type WCProvider = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

// 2重初期化を避けるためのシングルトン
let providerPromise: Promise<WCProvider> | null = null;

export async function createWCProvider(): Promise<WCProvider> {
  if (providerPromise) return providerPromise;

  providerPromise = (async () => {
    // 1) ESMとして直import（Viteがブラウザ実行に適したバンドルを作る）
    const { default: EthereumProvider } = await import("@walletconnect/ethereum-provider");

    const projectId = (import.meta as any).env.VITE_WC_PROJECT_ID as string;
    if (!projectId) throw new Error("VITE_WC_PROJECT_ID is missing");

    // 2) Provider 初期化（showQrModal: true でモーダルも自動有効）
    const provider: WCProvider = await (EthereumProvider as any).init({
      projectId,
      showQrModal: true,
      metadata: {
        name: "BizMaze Wallet Link",
        description: "Link your wallet",
        url: location.origin,
        icons: ["https://walletconnect.com/_next/static/media/logo.9f0f5e70.svg"],
      },
    } as EthereumProviderOptions);

    return provider;
  })();

  return providerPromise;
}

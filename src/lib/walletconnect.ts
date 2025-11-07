// src/lib/walletconnect.ts
//
// WalletConnect v2 (UMD) を確実に読み込み、ユーザー操作でモーダルを開く方式。
// 重要: バージョン固定（2.13.1 / 2.6.2）で Relay/Core の不整合を防ぐ。

export type WCProvider = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

const PROVIDER_UMD =
  "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.13.1/dist/index.umd.min.js";
const MODAL_UMD =
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/index.umd.min.js";

let loaded = false;

async function loadUMDOnce() {
  if (loaded) return;
  await new Promise<void>((res, rej) => {
    const s1 = document.createElement("script");
    s1.src = PROVIDER_UMD;
    s1.async = true;
    s1.onload = () => res();
    s1.onerror = () => rej(new Error("WalletConnect Provider UMD load failed"));
    document.head.appendChild(s1);
  });
  await new Promise<void>((res, rej) => {
    const s2 = document.createElement("script");
    s2.src = MODAL_UMD;
    s2.async = true;
    s2.onload = () => res();
    s2.onerror = () => rej(new Error("WalletConnect Modal UMD load failed"));
    document.head.appendChild(s2);
  });
  loaded = true;
}

// プロバイダ作成（ここではモーダルは“自動では出さない” → ユーザー操作で connect() ）
export async function createWCProvider(): Promise<WCProvider> {
  await loadUMDOnce();

  const projectId = (import.meta as any).env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("VITE_WC_PROJECT_ID is missing");

  const EthereumProvider = (window as any).EthereumProvider;
  if (!EthereumProvider) throw new Error("EthereumProvider missing (UMD)");

  // showQrModal: true にしておく（connect() 時のみ開く）
  const provider: WCProvider = await EthereumProvider.init({
    projectId,
    showQrModal: true,
    // 必要に応じてチェイン等を追加
    // chains: [1],
    metadata: {
      name: "BizMaze Wallet Link",
      description: "Link your wallet",
      url: location.origin,
      icons: ["https://walletconnect.com/_next/static/media/logo.9f0f5e70.svg"],
    },
  });

  return provider;
}
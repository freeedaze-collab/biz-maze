// src/lib/walletconnect.ts
// WalletConnect v2 を拡張機能なしで使うための軽量ローダ（UMD）
// 依存インストール不要：実行時に UMD をロードして window.* から利用します。

export type WCProvider = {
  enable: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  disconnect?: () => Promise<void>;
};

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = `__wc_script_${btoa(src).replace(/=+/g, "")}`;
    if (document.getElementById(id)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.id = id;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

/**
 * WalletConnect Ethereum Provider を初期化
 * - UMD を CDN からロードして `window` グローバルを参照
 * - MetaMask 非依存、スマホ通常ブラウザでも署名OK
 */
export async function initWalletConnect(): Promise<WCProvider> {
  const projectId = (import.meta as any).env?.VITE_WC_PROJECT_ID as string;
  if (!projectId) {
    throw new Error(
      "VITE_WC_PROJECT_ID is missing. Create one at https://cloud.walletconnect.com and set it in .env"
    );
  }

  // UMD を読み込み（ethereum-provider）
  // v2 UMD のグローバルは実装差があるため防御的に参照
  await loadScriptOnce(
    "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2/dist/index.umd.min.js"
  );

  // QR モーダル（@walletconnect/modal）は provider 側で内包されます（showQrModal: true）
  const g: any =
    (window as any).WalletConnectEthereumProvider ??
    (window as any).EthereumProvider ??
    (window as any).walletconnect?.EthereumProvider;

  if (!g?.EthereumProvider) {
    throw new Error("WalletConnect UMD not found (EthereumProvider missing).");
  }

  // 主要チェーン（例：Ethereum / Polygon / Arbitrum / Base）
  // 必要に応じて chains を調整
  const chains = [1, 137, 42161, 8453];

  const provider: WCProvider = await g.EthereumProvider.init({
    projectId,
    chains,
    showQrModal: true,
    optionalChains: [],
    // WalletConnect v2 はメソッド宣言が必要（少なくとも personal_sign）
    methods: ["personal_sign", "eth_sign"],
    events: ["chainChanged", "accountsChanged", "disconnect"],
    qrModalOptions: {
      themeMode: "light",
      enableExplorer: false,
    },
    metadata: {
      name: "Biz Maze",
      description: "Biz Maze Wallet Link",
      url: typeof location !== "undefined" ? location.origin : "https://biz-maze.app",
      icons: ["https://avatars.githubusercontent.com/u/13483694?s=200&v=4"],
    },
  });

  return provider;
}

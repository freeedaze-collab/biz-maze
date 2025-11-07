// src/lib/walletconnect.ts
// WalletConnect v2（UMD）ローダ：ブラウザ差異に強い安全実装

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
    s.crossOrigin = "anonymous";
    s.id = id;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

function pickProviderCtor(): any {
  const w: any = window as any;

  // 代表的な露出パターンを順に探索
  const cand = [
    w.EthereumProvider,
    w.WalletConnectEthereumProvider,
    w.walletconnect?.EthereumProvider,
    w.walletConnect?.EthereumProvider,
  ].filter(Boolean);

  // default 名前空間（UMD によっては default に入る）
  const withDefault = [
    w.EthereumProvider?.default,
    w.WalletConnectEthereumProvider?.default,
    w.walletconnect?.EthereumProvider?.default,
  ].filter(Boolean);

  return cand[0] ?? withDefault[0] ?? null;
}

export async function initWalletConnect(): Promise<WCProvider> {
  const projectId = (import.meta as any).env?.VITE_WC_PROJECT_ID as string;
  if (!projectId) {
    throw new Error(
      "VITE_WC_PROJECT_ID is missing. Set it in .env (get one at https://cloud.walletconnect.com)"
    );
  }

  // 1) 必要に応じて TextEncoder/Decoder をポリフィル（古い iOS 対策）
  // 通常は不要ですが、念のためチェック
  if (!(window as any).TextEncoder) {
    await loadScriptOnce("https://polyfill.io/v3/polyfill.min.js?features=TextEncoder,TextDecoder");
  }

  // 2) QR モーダル（いくつかのビルドでは別 UMD が必須）
  try {
    await loadScriptOnce(
      "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2/dist/index.umd.min.js"
    );
  } catch {
    /* modal の読み込み失敗は致命ではないため継続 */
  }

  // 3) Ethereum Provider 本体（UMD）
  await loadScriptOnce(
    "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2/dist/index.umd.min.js"
  );

  const Ctor = pickProviderCtor();
  if (!Ctor || !Ctor.init) {
    throw new Error("WalletConnect UMD not found (EthereumProvider.init missing).");
  }

  // よく使う L1/L2。必要に応じて調整可。
  const chains = [1, 137, 42161, 8453];

  const provider: WCProvider = await Ctor.init({
    projectId,
    chains,
    showQrModal: true,
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
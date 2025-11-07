// src/lib/walletconnect.ts
// WalletConnect v2 Provider robust loader for browser/iOS Safari.

export type WCProvider = {
  enable: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  disconnect?: () => Promise<void>;
};

type AnyFn = (...a: any[]) => any;

function log(...a: any[]) {
  // 開発中だけ noisy に
  console.log("[WC]", ...a);
}

function loadScript(src: string, id?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const exist = id ? document.getElementById(id) : null;
    if (exist) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    if (id) s.id = id;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

async function loadFirst(cands: { src: string; id?: string }[], label: string) {
  for (const c of cands) {
    try {
      await loadScript(c.src, c.id);
      log(`${label} loaded:`, c.src);
      return c.src;
    } catch (e) {
      log(`${label} failed:`, c.src, e);
    }
  }
  throw new Error(`${label} all candidates failed`);
}

function pickCtor(): any {
  const w: any = window as any;
  // 代表的な露出パターン
  const cand = [
    w.EthereumProvider,
    w.WalletConnectEthereumProvider,
    w.walletconnect?.EthereumProvider,
    w.walletConnect?.EthereumProvider,
  ].filter(Boolean);
  const def = [
    w.EthereumProvider?.default,
    w.WalletConnectEthereumProvider?.default,
    w.walletconnect?.EthereumProvider?.default,
  ].filter(Boolean);
  return cand[0] ?? def[0] ?? null;
}

async function ensureTextEncoder() {
  if (!(window as any).TextEncoder || !(window as any).TextDecoder) {
    await loadScript("https://polyfill.io/v3/polyfill.min.js?features=TextEncoder,TextDecoder");
    log("polyfilled TextEncoder/Decoder");
  }
}

export async function initWalletConnect(): Promise<WCProvider> {
  const projectId = (import.meta as any).env?.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("VITE_WC_PROJECT_ID missing");

  await ensureTextEncoder();

  // 1) モーダル（なくても致命ではないが showQrModal=true なら必要）
  try {
    await loadFirst(
      [
        { src: "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2/dist/index.umd.min.js", id: "__wc_modal_jsd" },
        { src: "https://unpkg.com/@walletconnect/modal@2/dist/index.umd.min.js", id: "__wc_modal_unp" },
        { src: "https://cdnjs.cloudflare.com/ajax/libs/walletconnect/2.11.3/modal/index.umd.min.js", id: "__wc_modal_cdn" }, // 例：バージョンは適宜調整
      ],
      "modal UMD"
    );
  } catch {
    log("modal UMD skipped");
  }

  // 2) Provider 本体 UMD（複数 CDN を試す）
  let ctor = null;
  try {
    await loadFirst(
      [
        { src: "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2/dist/index.umd.min.js", id: "__wc_ep_jsd" },
        { src: "https://unpkg.com/@walletconnect/ethereum-provider@2/dist/index.umd.min.js", id: "__wc_ep_unp" },
        { src: "https://cdnjs.cloudflare.com/ajax/libs/walletconnect/2.11.3/ethereum-provider/index.umd.min.js", id: "__wc_ep_cdn" }, // 例
      ],
      "provider UMD"
    );
    ctor = pickCtor();
  } catch (e) {
    log("UMD path failed -> fallback to ESM", e);
  }

  // 3) まだ見つからなければ ESM 直 import（esm.sh 経由）
  if (!ctor) {
    try {
      const mod: any = await import(
        "https://esm.sh/@walletconnect/ethereum-provider@2?bundle&target=es2020"
      );
      ctor = mod?.EthereumProvider ?? mod?.default ?? null;
      if (!ctor?.init) throw new Error("ESM ctor invalid");
      log("ESM provider loaded");
    } catch (e) {
      log("ESM import failed", e);
      throw new Error("WalletConnect provider not found (UMD & ESM failed).");
    }
  }

  const chains = [1, 137, 42161, 8453];
  const provider: WCProvider = await ctor.init({
    projectId,
    chains,
    showQrModal: true,
    methods: ["personal_sign", "eth_sign"],
    events: ["chainChanged", "accountsChanged", "disconnect"],
    qrModalOptions: { themeMode: "light", enableExplorer: false },
    metadata: {
      name: "Biz Maze",
      description: "Biz Maze Wallet Link",
      url: typeof location !== "undefined" ? location.origin : "https://biz-maze.app",
      icons: ["https://avatars.githubusercontent.com/u/13483694?s=200&v=4"],
    },
  });

  // iOS の一部で .enable() 要求がないと QR が開かないケースがある
  try {
    await provider.enable();
  } catch (e) {
    log("provider.enable warning:", e);
  }
  return provider;
}
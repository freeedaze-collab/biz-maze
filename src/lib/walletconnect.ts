// WalletConnect v2 UMD ローダ（self-host 優先 + CDN フォールバック）
// グローバル名の差異（EthereumProvider / WalletConnectEthereumProvider）に完全対応。

export type WCProvider = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

// ---- self-host 先（/public 配下に配置済みのはず）
const LOCAL_PROVIDER = "/walletconnect/provider/index.umd.min.js";
const LOCAL_MODAL_JS = "/walletconnect/modal/index.umd.min.js";
const LOCAL_MODAL_CSS = "/walletconnect/modal/style.css";

// ---- CDN フォールバック
const PROVIDER_SRCS = [
  LOCAL_PROVIDER,
  "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2/dist/umd/index.min.js",
  "https://unpkg.com/@walletconnect/ethereum-provider@2/dist/umd/index.min.js",
];

const MODAL_JS_SRCS = [
  LOCAL_MODAL_JS,
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/index.umd.min.js",
  "https://unpkg.com/@walletconnect/modal@2.6.2/dist/index.umd.min.js",
];

const MODAL_CSS_SRCS = [
  LOCAL_MODAL_CSS,
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/style.css",
  "https://unpkg.com/@walletconnect/modal@2.6.2/dist/style.css",
];

// ---- utils
function withTimeout<T>(p: Promise<T>, ms: number, tag: string) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${tag} timed out (${ms}ms)`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); })
     .catch(e => { clearTimeout(t); reject(e); });
  });
}

function loadScript(src: string): Promise<void> {
  return new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    const isLocal = src.startsWith("/") || src.startsWith(location.origin);
    s.src = isLocal ? src : `${src}${src.includes("?") ? "" : `?v=${Date.now()}`}`;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => res();
    s.onerror = () => rej(new Error(`script load failed: ${src}`));
    document.head.appendChild(s);
  });
}

function loadCss(href: string): Promise<void> {
  return new Promise<void>((res, rej) => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    const isLocal = href.startsWith("/") || href.startsWith(location.origin);
    l.href = isLocal ? href : `${href}${href.includes("?") ? "" : `?v=${Date.now()}`}`;
    l.crossOrigin = "anonymous";
    l.onload = () => res();
    l.onerror = () => rej(new Error(`css load failed: ${href}`));
    document.head.appendChild(l);
  });
}

async function tryList(candidates: string[], tag: string, isCss = false, timeoutMs = 10000) {
  const errs: string[] = [];
  for (const url of candidates) {
    try {
      if (isCss) {
        await withTimeout(loadCss(url), timeoutMs, `${tag} css`);
      } else {
        await withTimeout(loadScript(url), timeoutMs, `${tag} js`);
      }
      return; // success
    } catch (e: any) {
      errs.push(`${url} -> ${e?.message ?? e}`);
    }
  }
  throw new Error(`${tag} UMD load failed:\n${errs.join("\n")}`);
}

// ---- グローバル検出（両方名を見る）
function getWCGlobal(): any {
  const g: any = window as any;
  return g.EthereumProvider || g.WalletConnectEthereumProvider || g.WalletConnectProvider || null;
}
function getWCGlobalDebug() {
  const g: any = window as any;
  return {
    has_EthereumProvider: !!g.EthereumProvider,
    has_WalletConnectEthereumProvider: !!g.WalletConnectEthereumProvider,
    has_WalletConnectProvider: !!g.WalletConnectProvider,
  };
}

let loaded = false;

async function ensureUMDLoaded() {
  if (loaded) return;

  // 0) すでに script タグで読み込まれているならそれを使う
  if (getWCGlobal()) { loaded = true; return; }

  // 1) Provider（必須）
  await tryList(PROVIDER_SRCS, "WalletConnect Provider");

  // 読み込み後にもう一度チェック
  if (!getWCGlobal()) {
    // 2) Modal を読む前に、検出状況を詳細表示して失敗
    const dbg = getWCGlobalDebug();
    throw new Error(
      `EthereumProvider missing after UMD load\n` +
      JSON.stringify(dbg, null, 2)
    );
  }

  // 3) Modal CSS（見た目だけなので失敗は無視して続行）
  try { await tryList(MODAL_CSS_SRCS, "WalletConnect Modal", true, 8000); } catch {}

  // 4) Modal JS（将来の UI 用。現状 connect() で自動表示される）
  try { await tryList(MODAL_JS_SRCS, "WalletConnect Modal"); } catch {}

  loaded = true;
}

export async function createWCProvider(): Promise<WCProvider> {
  await ensureUMDLoaded();

  const g: any = window as any;
  const EthereumProvider =
    g.EthereumProvider || g.WalletConnectEthereumProvider || g.WalletConnectProvider;

  if (!EthereumProvider) {
    const dbg = getWCGlobalDebug();
    throw new Error(
      `EthereumProvider not found (post-ensure)\n` +
      JSON.stringify(dbg, null, 2)
    );
  }

  const projectId = (import.meta as any).env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("VITE_WC_PROJECT_ID is missing");

  const provider: WCProvider = await EthereumProvider.init({
    projectId,
    showQrModal: true,
    metadata: {
      name: "BizMaze Wallet Link",
      description: "Link your wallet",
      url: location.origin,
      icons: ["https://walletconnect.com/_next/static/media/logo.9f0f5e70.svg"],
    },
  });

  return provider;
}
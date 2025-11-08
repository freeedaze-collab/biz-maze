// src/lib/walletconnect.ts
// WalletConnect v2 UMD ローダ（モバイルでも確実動作）。
// 1) まず /public に置いたローカル UMD/CSS を読みに行く
// 2) 失敗したら jsDelivr → UNPKG の順でフォールバック
// 3) CSSは無くても機能は続行（見た目のみ影響）

export type WCProvider = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

// ★ ここを /walletconnect/ に統一（/wc/ ではありません）
const LOCAL_PROVIDER = "/walletconnect/provider/index.umd.min.js";
const LOCAL_MODAL_JS = "/walletconnect/modal/index.umd.min.js";
const LOCAL_MODAL_CSS = "/walletconnect/modal/style.css";

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

// CSS は style.css / index.css の両方を試す
const MODAL_CSS_SRCS = [
  LOCAL_MODAL_CSS,
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/style.css",
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/index.css",
  "https://unpkg.com/@walletconnect/modal@2.6.2/dist/style.css",
  "https://unpkg.com/@walletconnect/modal@2.6.2/dist/index.css",
];

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
      if (isCss) await withTimeout(loadCss(url), timeoutMs, `${tag} css`);
      else       await withTimeout(loadScript(url), timeoutMs, `${tag} js`);
      return; // success
    } catch (e: any) {
      errs.push(`${url} -> ${e?.message ?? e}`);
    }
  }
  throw new Error(`${tag} load failed:\n${errs.join("\n")}`);
}

let loaded = false;

async function ensureUMDLoaded() {
  if (loaded) return;

  await tryList(PROVIDER_SRCS, "WalletConnect Provider UMD", false, 12000);

  try {
    await tryList(MODAL_CSS_SRCS, "WalletConnect Modal CSS", true, 8000);
  } catch (e) {
    console.warn(String(e)); // CSSは非致命
  }

  await tryList(MODAL_JS_SRCS, "WalletConnect Modal UMD", false, 12000);

  if (!(window as any).EthereumProvider) {
    throw new Error("EthereumProvider missing after UMD load");
  }
  loaded = true;
}

export async function createWCProvider(): Promise<WCProvider> {
  await ensureUMDLoaded();

  const projectId = (import.meta as any).env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("VITE_WC_PROJECT_ID is missing");

  const EthereumProvider = (window as any).EthereumProvider;
  const provider: WCProvider = await EthereumProvider.init({
    projectId,
    showQrModal: true, // connect() 時にモーダルを開く
    metadata: {
      name: "BizMaze Wallet Link",
      description: "Link your wallet",
      url: location.origin,
      icons: ["https://walletconnect.com/_next/static/media/logo.9f0f5e70.svg"],
    },
  });

  return provider;
}

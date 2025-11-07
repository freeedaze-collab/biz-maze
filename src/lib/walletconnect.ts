// src/lib/walletconnect.ts
//
// WalletConnect v2 UMD をモバイル Safari / Chrome でも確実に読み込む多段ローダ。
// CSS は style.css / index.css の両方を試行し、両方失敗しても JS は続行。

export type WCProvider = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

const PROVIDER_SRCS = [
  // Provider UMD（2 系）
  "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2/dist/umd/index.min.js",
  "https://unpkg.com/@walletconnect/ethereum-provider@2/dist/umd/index.min.js",
];

const MODAL_JS_SRCS = [
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/index.umd.min.js",
  "https://unpkg.com/@walletconnect/modal@2.6.2/dist/index.umd.min.js",
];

// ⚠️ CDN により dist の CSS ファイル名が異なることがあるため両方試行
const MODAL_CSS_SRCS = [
  // jsDelivr
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/style.css",
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/index.css",
  // unpkg
  "https://unpkg.com/@walletconnect/modal@2.6.2/dist/style.css",
  "https://unpkg.com/@walletconnect/modal@2.6.2/dist/index.css",
];

function withTimeout<T>(p: Promise<T>, ms: number, tag: string) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${tag} timed out (${ms}ms)`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

function loadScript(src: string): Promise<void> {
  return new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = src + (src.includes("?") ? "" : `?v=${Date.now()}`); // cache-bust
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
    l.href = href + (href.includes("?") ? "" : `?v=${Date.now()}`); // cache-bust
    l.crossOrigin = "anonymous";
    l.onload = () => res();
    l.onerror = () => rej(new Error(`css load failed: ${href}`));
    document.head.appendChild(l);
  });
}

async function tryList(
  candidates: string[],
  tag: string,
  isCss = false,
  timeoutMs = 10000
) {
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
  throw new Error(`${tag} load failed: \n${errs.join("\n")}`);
}

let loaded = false;

async function ensureUMDLoaded() {
  if (loaded) return;

  // 1) Provider JS（必須）
  await tryList(PROVIDER_SRCS, "WalletConnect Provider UMD", false, 12000);

  // 2) Modal CSS（非致命で試行：style.css / index.css 両方）
  let cssOk = true;
  try {
    await tryList(MODAL_CSS_SRCS, "WalletConnect Modal CSS", true, 8000);
  } catch (e: any) {
    cssOk = false;
    console.warn(String(e?.message ?? e));
    // CSS 失敗でも JS は続行する（見た目の乱れは発生し得るが、機能は動かす）
  }

  // 3) Modal JS
  await tryList(MODAL_JS_SRCS, "WalletConnect Modal UMD", false, 12000);

  // グローバル確認
  const EthereumProvider = (window as any).EthereumProvider;
  if (!EthereumProvider) {
    throw new Error("EthereumProvider missing after UMD load");
  }
  if (!cssOk) {
    // UI 側で分かるよう軽いダイアログに出したい場合は例外ではなく return 値で渡す設計にする
    console.warn("WalletConnect Modal CSS could not be loaded; continuing without CSS.");
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
    showQrModal: true, // connect() 実行時にモーダルを開く
    metadata: {
      name: "BizMaze Wallet Link",
      description: "Link your wallet",
      url: location.origin,
      icons: ["https://walletconnect.com/_next/static/media/logo.9f0f5e70.svg"],
    },
  });

  return provider;
}
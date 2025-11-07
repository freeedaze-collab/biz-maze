// src/lib/walletconnect.ts
//
// WalletConnect v2 UMD をモバイル Safari でも確実に読み込むための多段ローダ。
// 失敗時はエラーメッセージを返し、UI 側で alert に出せるようにする。

export type WCProvider = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

const PROVIDER_SRCS = [
  // 1st: jsDelivr（高速 CDN）
  "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.13.1/dist/index.umd.min.js",
  // 2nd: UNPKG（フォールバック）
  "https://unpkg.com/@walletconnect/ethereum-provider@2.13.1/dist/index.umd.min.js",
];

const MODAL_JS_SRCS = [
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/index.umd.min.js",
  "https://unpkg.com/@walletconnect/modal@2.6.2/dist/index.umd.min.js",
];

// モーダルは CSS が無いと描画時に例外が出るケースがある
const MODAL_CSS_SRCS = [
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/style.css",
  "https://unpkg.com/@walletconnect/modal@2.6.2/dist/style.css",
];

function withTimeout<T>(p: Promise<T>, ms: number, tag: string) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${tag} timed out (${ms}ms)`)),
      ms
    );
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

function loadScript(src: string): Promise<void> {
  return new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = src + (src.includes("?") ? "" : `?v=${Date.now()}`); // キャッシュ回避
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
    l.href = href;
    l.crossOrigin = "anonymous";
    l.onload = () => res();
    l.onerror = () => rej(new Error(`css load failed: ${href}`));
    document.head.appendChild(l);
  });
}

async function loadFirstAvailable(
  candidates: string[],
  tag: string,
  isCss = false
) {
  const errs: string[] = [];
  for (const url of candidates) {
    try {
      if (isCss) {
        await withTimeout(loadCss(url), 8000, `${tag} css`);
      } else {
        await withTimeout(loadScript(url), 10000, `${tag} js`);
      }
      return; // 成功
    } catch (e: any) {
      errs.push(`${url} -> ${e?.message ?? e}`);
    }
  }
  throw new Error(`${tag} UMD load failed: \n${errs.join("\n")}`);
}

let loaded = false;

async function ensureUMDLoaded() {
  if (loaded) return;

  // 1) Provider JS
  await loadFirstAvailable(PROVIDER_SRCS, "WalletConnect Provider");

  // 2) Modal CSS（先に CSS）
  await loadFirstAvailable(MODAL_CSS_SRCS, "WalletConnect Modal", true);

  // 3) Modal JS
  await loadFirstAvailable(MODAL_JS_SRCS, "WalletConnect Modal");

  // グローバル確認
  const EthereumProvider = (window as any).EthereumProvider;
  if (!EthereumProvider) {
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
    // モーダルは “connect() を呼んだときだけ” 開く
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
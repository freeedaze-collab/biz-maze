// src/lib/walletconnect.ts
// WalletConnect v2 UMD ローダ（多CDN + CSSはfetchでインライン注入）

export type WCProvider = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

const PROVIDER_SRCS = [
  // 正しい UMD パス（/dist/umd/index.min.js）
  "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2/dist/umd/index.min.js",
  "https://unpkg.com/@walletconnect/ethereum-provider@2/dist/umd/index.min.js",
];

const MODAL_JS_SRCS = [
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/index.umd.min.js",
  "https://unpkg.com/@walletconnect/modal@2.6.2/dist/index.umd.min.js",
];

const MODAL_CSS_SRCS = [
  "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/style.css",
  "https://unpkg.com/@walletconnect/modal@2.6.2/dist/style.css",
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
    s.src = src + (src.includes("?") ? "" : `?v=${Date.now()}`); // cache bust
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => res();
    s.onerror = () => rej(new Error(`script load failed: ${src}`));
    document.head.appendChild(s);
  });
}

// CSS は link で失敗しやすいので fetch→<style> でインライン注入
async function inlineCssFrom(url: string) {
  const r = await fetch(url, { mode: "cors", cache: "force-cache" });
  if (!r.ok) throw new Error(`css fetch failed: ${url} (${r.status})`);
  const css = await r.text();
  const st = document.createElement("style");
  st.setAttribute("data-wc-modal-inline", "1");
  st.textContent = css;
  document.head.appendChild(st);
}

async function ensureModalCss() {
  if (document.querySelector("style[data-wc-modal-inline]")) return;
  const errs: string[] = [];
  for (const u of MODAL_CSS_SRCS) {
    try {
      await withTimeout(inlineCssFrom(u), 8000, "wc modal css");
      return;
    } catch (e: any) {
      errs.push(`${u} -> ${e?.message ?? e}`);
    }
  }
  throw new Error(`WalletConnect Modal CSS load failed:\n${errs.join("\n")}`);
}

async function loadFirstAvailable(candidates: string[], tag: string) {
  const errs: string[] = [];
  for (const url of candidates) {
    try {
      await withTimeout(loadScript(url), 10000, `${tag} js`);
      return; // 成功
    } catch (e: any) {
      errs.push(`${url} -> ${e?.message ?? e}`);
    }
  }
  throw new Error(`${tag} UMD load failed:\n${errs.join("\n")}`);
}

let loaded = false;
async function ensureUMDLoaded() {
  if (loaded) return;

  // 1) Provider UMD
  await loadFirstAvailable(PROVIDER_SRCS, "WalletConnect Provider");

  // 2) Modal CSS（先にインライン注入）
  await ensureModalCss();

  // 3) Modal UMD
  await loadFirstAvailable(MODAL_JS_SRCS, "WalletConnect Modal");

  // グローバル確認（← ここ重要）
  const WCE = (window as any).WalletConnectEthereumProvider;
  if (!WCE) throw new Error("WalletConnectEthereumProvider missing after UMD load");

  loaded = true;
}

export async function createWCProvider(): Promise<WCProvider> {
  await ensureUMDLoaded();

  const projectId = (import.meta as any).env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("VITE_WC_PROJECT_ID is missing");

  const WCE = (window as any).WalletConnectEthereumProvider;

  const provider: WCProvider = await WCE.init({
    projectId,
    showQrModal: true, // connect() でモーダル表示
    metadata: {
      name: "BizMaze Wallet Link",
      description: "Link your wallet",
      url: location.origin,
      icons: ["https://walletconnect.com/_next/static/media/logo.9f0f5e70.svg"],
    },
  });

  return provider;
}
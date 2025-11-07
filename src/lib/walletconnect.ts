// src/lib/walletconnect.ts
// WalletConnect v2 を “ESM 動的 import（UNPKG ?module / jsDelivr +esm）”でロード。
// 失敗時のみ UMD にフォールバック。モーダル CSS は fetch→<style> にインライン注入。

export type WCProvider = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

const ESM_PROVIDER = [
  // jsDelivr: 依存をESM化してくれる +esm
  "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2/+esm",
  // UNPKG: 依存をESM化してくれる ?module
  "https://unpkg.com/@walletconnect/ethereum-provider@2?module",
];

const UMD_PROVIDER = [
  "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2/dist/umd/index.min.js",
  "https://unpkg.com/@walletconnect/ethereum-provider@2/dist/umd/index.min.js",
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

// ---- CSS は <link> ではなく fetch→<style> で注入（iOSで安定）
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
    try { await withTimeout(inlineCssFrom(u), 8000, "wc modal css"); return; }
    catch (e: any) { errs.push(`${u} -> ${e?.message ?? e}`); }
  }
  throw new Error(`WalletConnect Modal CSS load failed:\n${errs.join("\n")}`);
}

// ---- UMD ロード（最終手段）
function loadScript(src: string): Promise<void> {
  return new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = src + (src.includes("?") ? "" : `?v=${Date.now()}`); // cache bust
    s.async = true; s.crossOrigin = "anonymous";
    s.onload = () => res();
    s.onerror = () => rej(new Error(`script load failed: ${src}`));
    document.head.appendChild(s);
  });
}
async function loadUMDProvider() {
  const errs: string[] = [];
  for (const url of UMD_PROVIDER) {
    try { await withTimeout(loadScript(url), 10000, "wc provider umd"); return; }
    catch (e: any) { errs.push(`${url} -> ${e?.message ?? e}`); }
  }
  throw new Error(`WalletConnect Provider UMD load failed:\n${errs.join("\n")}`);
}

// ---- ESM → UMD の順で EthereumProvider を解決
let loaded = false;
let EthereumProviderCtor: any = null;

async function ensureProviderLoaded() {
  if (loaded) return;

  // 1) まずモーダル CSS（どの経路でも必要）
  await ensureModalCss();

  // 2) ESM を優先（UNPKG ?module / jsDelivr +esm）
  const esmErrs: string[] = [];
  for (const url of ESM_PROVIDER) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - 動的URL importを許可（Vite最適化抑止）
      const mod = await withTimeout(import(/* @vite-ignore */ url), 12000, "wc provider esm");
      const ctor = (mod as any).EthereumProvider || (mod as any).default?.EthereumProvider || (mod as any).default;
      if (!ctor) throw new Error("ESM: EthereumProvider not found in module");
      EthereumProviderCtor = ctor;
      loaded = true;
      return;
    } catch (e: any) {
      esmErrs.push(`${url} -> ${e?.message ?? e}`);
    }
  }

  // 3) だめなら UMD フォールバック
  try {
    await loadUMDProvider();
    const WCE = (window as any).WalletConnectEthereumProvider;
    if (!WCE) throw new Error("UMD: WalletConnectEthereumProvider missing");
    EthereumProviderCtor = WCE;
    loaded = true;
    return;
  } catch (e: any) {
    const umdMsg = e?.message ?? String(e);
    throw new Error(`WalletConnect load failed.\nESM:\n${esmErrs.join("\n")}\nUMD:\n${umdMsg}`);
  }
}

export async function createWCProvider(): Promise<WCProvider> {
  await ensureProviderLoaded();

  const projectId = (import.meta as any).env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("VITE_WC_PROJECT_ID is missing");

  const provider: WCProvider = await EthereumProviderCtor.init({
    projectId,
    showQrModal: true, // connect() でモーダルを開く
    metadata: {
      name: "BizMaze Wallet Link",
      description: "Link your wallet",
      url: location.origin,
      icons: ["https://walletconnect.com/_next/static/media/logo.9f0f5e70.svg"],
    },
  });

  return provider;
}
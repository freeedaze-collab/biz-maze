// WalletConnect v2 loader: self-host検証 → CDN → ESM dynamic import の三段fallback。
// グローバル名差異にも対応（EthereumProvider / WalletConnectEthereumProvider / WalletConnectProvider）

export type WCProvider = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
};

const LOCAL = {
  provider: "/walletconnect/provider/index.umd.min.js",
  modalJs: "/walletconnect/modal/index.umd.min.js",
  modalCss: "/walletconnect/modal/style.css",
};

const CDN = {
  provider: [
    "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2/dist/umd/index.min.js",
    "https://unpkg.com/@walletconnect/ethereum-provider@2/dist/umd/index.min.js",
  ],
  modalJs: [
    "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/index.umd.min.js",
    "https://unpkg.com/@walletconnect/modal@2.6.2/dist/index.umd.min.js",
  ],
  modalCss: [
    "https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/dist/style.css",
    "https://unpkg.com/@walletconnect/modal@2.6.2/dist/style.css",
  ],
  // 最終手段（ESM）
  providerEsm: "https://esm.sh/@walletconnect/ethereum-provider@2?bundle",
};

function g(): any { return window as any; }
function pickGlobal() {
  return g().EthereumProvider || g().WalletConnectEthereumProvider || g().WalletConnectProvider || null;
}
function debugFlags() {
  return {
    has_EthereumProvider: !!g().EthereumProvider,
    has_WalletConnectEthereumProvider: !!g().WalletConnectEthereumProvider,
    has_WalletConnectProvider: !!g().WalletConnectProvider,
  };
}

function loadScript(src: string, timeout = 12_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    const isLocal = src.startsWith("/") || src.startsWith(location.origin);
    s.src = isLocal ? src : `${src}${src.includes("?") ? "" : `?v=${Date.now()}`}`;
    s.async = true;
    s.crossOrigin = "anonymous";
    const t = setTimeout(() => reject(new Error(`timeout: ${src}`)), timeout);
    s.onload = () => { clearTimeout(t); resolve(); };
    s.onerror = () => { clearTimeout(t); reject(new Error(`script error: ${src}`)); };
    document.head.appendChild(s);
  });
}
function loadCss(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    const isLocal = href.startsWith("/") || href.startsWith(location.origin);
    l.href = isLocal ? href : `${href}${href.includes("?") ? "" : `?v=${Date.now()}`}`;
    l.crossOrigin = "anonymous";
    l.onload = () => resolve();
    l.onerror = () => reject(new Error(`css error: ${href}`));
    document.head.appendChild(l);
  });
}

// 自前ファイルの実体チェック：200系 && text/javascript(or application/javascript) && 十分なサイズ && キーワード含有
async function probeLocalJs(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("javascript")) return false;
    const txt = await res.text();
    if (txt.length < 10_000) return false; // 小さすぎる＝HTMLダミーの可能性
    if (!/EthereumProvider|WalletConnect/i.test(txt)) return false;
    return true;
  } catch { return false; }
}

async function tryMany(urls: string[]) {
  const errs: string[] = [];
  for (const u of urls) {
    try { await loadScript(u); return; }
    catch (e: any) { errs.push(`${u} -> ${e?.message ?? e}`); }
  }
  throw new Error(errs.join("\n"));
}

let loaded = false;

async function ensureLoaded() {
  if (loaded) return;

  // 0) 既にいる？
  if (pickGlobal()) { loaded = true; return; }

  // 1) 自前 provider を“実体チェック”してから読む。ダメなら CDN へ。
  const localOk = await probeLocalJs(LOCAL.provider);
  try {
    if (localOk) {
      await loadScript(LOCAL.provider);
    } else {
      await tryMany(CDN.provider);
    }
  } catch (e) {
    // provider UMD フォールバック(ESM import)
    try {
      const mod: any = await import(/* @vite-ignore */ CDN.providerEsm);
      const EP = mod?.default || mod?.EthereumProvider || mod;
      if (EP) (g().EthereumProvider ||= EP);
    } catch {}
  }

  // provider を見つける
  if (!pickGlobal()) {
    throw new Error(
      "EthereumProvider missing after provider load\n" + JSON.stringify(debugFlags(), null, 2)
    );
  }

  // 2) Modal（CSSはベストエフォート）
  try { await loadCss(LOCAL.modalCss); } catch { try { await loadCss(CDN.modalCss[0]); } catch {} }
  try { await loadScript(LOCAL.modalJs); } catch { try { await tryMany(CDN.modalJs); } catch {} }

  loaded = true;
}

export async function createWCProvider(): Promise<WCProvider> {
  await ensureLoaded();

  const EP = pickGlobal();
  if (!EP) {
    throw new Error(
      "EthereumProvider not found (post ensure)\n" + JSON.stringify(debugFlags(), null, 2)
    );
  }

  const projectId = (import.meta as any).env.VITE_WC_PROJECT_ID as string;
  if (!projectId) throw new Error("VITE_WC_PROJECT_ID is missing");

  const provider: WCProvider = await EP.init({
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

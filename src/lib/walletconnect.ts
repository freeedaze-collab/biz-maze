// src/lib/walletconnect.ts
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

// Provider の最終手段（ESM）
const ESM_CANDIDATES = [
  "https://esm.sh/@walletconnect/ethereum-provider@2?bundle&target=es2020",
  "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2/dist/index.js",
];

function W(): any { return window as any; }
function pickGlobal() {
  return W().EthereumProvider || W().WalletConnectEthereumProvider || W().WalletConnectProvider || null;
}

function loadScript(src: string, timeout = 12000): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    const t = setTimeout(() => reject(new Error(`timeout: ${src}`)), timeout);
    s.onload = () => { clearTimeout(t); resolve(); };
    s.onerror = () => { clearTimeout(t); reject(new Error(`js load failed: ${src}`)); };
    document.head.appendChild(s);
  });
}
function loadCss(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.crossOrigin = "anonymous";
    l.onload = () => resolve();
    l.onerror = () => reject(new Error(`css load failed: ${href}`));
    document.head.appendChild(l);
  });
}

async function importManyEsm(urls: string[]) {
  const errs: string[] = [];
  for (const u of urls) {
    try {
      // @vite-ignore: 動的 import を許可
      const mod: any = await import(/* @vite-ignore */ u);
      const EP = mod?.default || mod?.EthereumProvider || mod;
      if (EP) {
        W().EthereumProvider ||= EP;
        W().WalletConnectEthereumProvider ||= EP;
        return;
      }
    } catch (e: any) {
      errs.push(`${u} -> ${e?.message ?? e}`);
    }
  }
  throw new Error("esm import failed:\n" + errs.join("\n"));
}

let loaded = false;

async function ensureLoaded() {
  if (loaded) return;

  // 既にあれば終わり
  if (pickGlobal()) { loaded = true; return; }

  // ---- Provider: 自前 → ESM
  let providerOk = false;
  try {
    await loadScript(LOCAL.provider);
    providerOk = !!pickGlobal();
  } catch {}

  if (!providerOk) {
    try {
      await importManyEsm(ESM_CANDIDATES);
      providerOk = !!pickGlobal();
    } catch (e) {
      // fall through
    }
  }

  if (!providerOk) {
    throw new Error("EthereumProvider missing after UMD/ESM load");
  }

  // ---- Modal（ローカルのみ。失敗しても throw しない）
  try { await loadCss(LOCAL.modalCss); } catch {}
  try { await loadScript(LOCAL.modalJs); } catch {}

  loaded = true;
}

export async function createWCProvider(): Promise<WCProvider> {
  await ensureLoaded();

  const EP = pickGlobal();
  if (!EP) throw new Error("EthereumProvider not found (post ensure)");

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

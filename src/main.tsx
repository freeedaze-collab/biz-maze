// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { AuthProvider } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import App from "./App";
import DebugOverlay from "@/components/DebugOverlay";

/**
 * Preview/CDN でも落ちないための自動フォールバック:
 *  - default: BrowserRouter
 *  - preview--*.lovable.app / file:// / VITE_FORCE_HASH="1" は HashRouter
 */
function shouldUseHashRouter(): boolean {
  const force = import.meta.env.VITE_FORCE_HASH === "1";
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isPreview = host.startsWith("preview--");
  const isFile = typeof window !== "undefined" && window.location.protocol === "file:";
  return force || isPreview || isFile;
}

const Router = shouldUseHashRouter() ? HashRouter : BrowserRouter;
const qc = new QueryClient();

// グローバル・エラーフック（初期化前に死なないように）
window.addEventListener("error", (ev) => {
  // Consoleが沈黙するケース向けに最低限出力
  try { console.error("[window.onerror]", ev.message, ev.filename, ev.lineno, ev.colno); } catch {}
});
window.addEventListener("unhandledrejection", (ev) => {
  try { console.error("[unhandledrejection]", ev.reason); } catch {}
});

// デバッグ用: 明示的に supabase を公開（必要時のみ）
if (import.meta.env.VITE_DEBUG === "1") {
  (window as any).supabase = supabase;
  (window as any).__BOOT = {
    ...(window as any).__BOOT,
    jsMountedAt: Date.now(),
  };
  console.log("[BOOT] main.tsx started", {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    HASH_ROUTER: shouldUseHashRouter(),
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={qc}>
          <Router>
            <App />
            {/* VITE_DEBUG=1 のときだけデバッグオーバーレイ */}
            <DebugOverlay />
          </Router>
        </QueryClientProvider>
      </WagmiProvider>
    </AuthProvider>
  </React.StrictMode>
);

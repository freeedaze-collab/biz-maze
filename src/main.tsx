// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { GlobalErrorTrap } from "@/components/GlobalErrorTrap";

// 予期せぬ同期例外で白画面にならないよう try-catch で最終防衛
const rootEl = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootEl);

const qc = new QueryClient();

try {
  root.render(
    <React.StrictMode>
      <GlobalErrorTrap>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={qc}>
            <AuthProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </AuthProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </GlobalErrorTrap>
    </React.StrictMode>
  );
} catch (e) {
  // eslint-disable-next-line no-console
  console.error("[bootstrap] fatal render error:", e);
  rootEl.innerHTML =
    `<pre style="padding:12px;border:1px solid #ef4444;background:#fee2e2;color:#111;">
[bootstrap] fatal render error:
${(e as any)?.stack || String(e)}
</pre>`;
}

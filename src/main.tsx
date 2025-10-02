// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// wagmi
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";

// react-query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// router
import { HashRouter } from "react-router-dom";

// ★ 追加: AuthProvider を読み込み
import { AuthProvider } from "@/contexts/AuthProvider"; 
// ※ 実際のファイルパスが src/contexts/AuthProvider.tsx or src/context/useAuth.tsx などか要確認。
// プロジェクト内の AuthProvider 定義ファイルに合わせて修正してください。

const isDev = import.meta.env.DEV;
const queryClient = new QueryClient();

const Root = (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider> {/* ★ ここでAuthProviderで全体をラップ */}
        <HashRouter>
          <App />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

const AppRoot = isDev ? Root : (
  <React.StrictMode>{Root}</React.StrictMode>
);

ReactDOM.createRoot(document.getElementById("root")!).render(AppRoot);

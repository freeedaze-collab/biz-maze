// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// wagmi
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/config/wagmi";

// react-query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ★ ルーターを BrowserRouter → HashRouter に変更（開発中の直リンク/リロードに強い）
import { HashRouter } from "react-router-dom";

// React 18 の開発モードでは StrictMode により useEffect が2回走り、
// WalletConnectや外部SDKの初期化が二重起動→不安定化することがあります。
// 本番ビルドには StrictMode を残し、開発中だけ無効化します。
const isDev = import.meta.env.DEV;

// QueryClient は単一インスタンスで
const queryClient = new QueryClient();

const Root = (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </WagmiProvider>
);

// 開発時は StrictMode を外す／本番は付ける
const AppRoot = isDev ? Root : (
  <React.StrictMode>{Root}</React.StrictMode>
);

ReactDOM.createRoot(document.getElementById("root")!).render(AppRoot);

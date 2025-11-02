// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// あなたのプロジェクトの実体に合わせて import してください
import { supabase } from "@/integrations/supabase/client";

// wagmi v2
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter, createBrowserRouter, RouterProvider } from "react-router-dom";
import { wagmiConfig } from "@/wagmi/config"; // 下のファイルを作成します
import { AuthProvider } from "@/hooks/useAuth"; // 既存の AuthProvider を想定

const qc = new QueryClient();

// プレビュー（静的）では HashRouter、本番でリライト可能なら BrowserRouter
const useHash = typeof window !== "undefined" && (
  window.location.host.startsWith("preview--") ||
  import.meta.env.VITE_FORCE_HASH === "1"
);

const router = useHash
  ? createHashRouter([{ path: "/*", element: <App /> }])
  : createBrowserRouter([{ path: "/*", element: <App /> }]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={qc}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </WagmiProvider>
    </AuthProvider>
  </React.StrictMode>
);

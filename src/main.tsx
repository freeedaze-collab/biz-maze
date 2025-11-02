// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Supabase クライアント（プロジェクト標準パス）
import { supabase } from "@/integrations/supabase/client";

// wagmi / React Query / Router
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter, createBrowserRouter, RouterProvider } from "react-router-dom";

// ❗ 実体は src/config/wagmi.ts
import { wagmiConfig } from "@/config/wagmi";
import { AuthProvider } from "@/hooks/useAuth";

const qc = new QueryClient();

// プレビュー（静的）では HashRouter、本番でリライト可能なら BrowserRouter に自動切替
const useHash =
  typeof window !== "undefined" &&
  (window.location.host.startsWith("preview--") ||
    import.meta.env.VITE_FORCE_HASH === "1");

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

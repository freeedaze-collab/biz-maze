// src/main.tsx
import React from "react";

// HOTFIX: Patch postMessage to avoid "Invalid target origin 'null'" error
// This likely comes from a dev tool or library (e.g. lovable-tagger or similar) passing null origin.
try {
  const originalPostMessage = window.postMessage;
  window.postMessage = function (message: any, targetOrigin: string, transfer?: Transferable[]) {
    if (targetOrigin === "null" || targetOrigin === null) {
      // console.warn("Intercepted postMessage with invalid origin 'null', replacing with '*'", message);
      // Replace invalid origin with wildcard to prevent crash
      targetOrigin = "*";
    }
    return originalPostMessage.call(window, message, targetOrigin, transfer as any);
  };
} catch (e) {
  console.error("Failed to patch postMessage", e);
}

import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/feel-theme.css";

// Supabase standard client (keep as-is in your project)
import { supabase } from "@/integrations/supabase/client";

// wagmi / query / router
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHashRouter, createBrowserRouter, RouterProvider } from "react-router-dom";

// ❗ 実体は src/config/wagmi.ts
import { wagmiConfig } from "@/config/wagmi";
import { AuthProvider } from "@/hooks/useAuth";

const qc = new QueryClient();

// 静的プレビュー（preview--）では HashRouter、本番でリライト可なら BrowserRouter
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

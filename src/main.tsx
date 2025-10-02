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

// ★ src/hooks/useAuth.tsx から AuthProvider を import
import { AuthProvider } from "@/hooks/useAuth";

const isDev = import.meta.env.DEV;
const queryClient = new QueryClient();

const Root = (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider> {/* AuthProvider でラップ */}
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

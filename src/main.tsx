// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// ルータ：プレビュー/CDNで 404 を避けるための自動フォールバックは残す
import { BrowserRouter, HashRouter } from "react-router-dom";

// ★ AuthProvider を最上位に置く（これが無いと useAuth が落ちる）
import { AuthProvider } from "@/hooks/useAuth";

/**
 * プレビュー/CDNでも落ちないための自動フォールバック
 * - 既定: BrowserRouter
 * - Lovable preview など SPA 404 が起こる環境では HashRouter
 * - .env で VITE_FORCE_HASH="1" を入れると強制ハッシュ
 */
function shouldUseHashRouter(): boolean {
  const force = import.meta.env.VITE_FORCE_HASH === "1";
  const host = window.location.hostname || "";
  const isPreview = host.startsWith("preview--");
  const isFile = window.location.protocol === "file:";
  return force || isPreview || isFile;
}
const RouterComp = shouldUseHashRouter() ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterComp>
        <App />
      </RouterComp>
    </AuthProvider>
  </React.StrictMode>
);

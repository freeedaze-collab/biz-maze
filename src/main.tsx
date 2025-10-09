// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// wagmi / react-query / Supabase 等のプロバイダは
// 既存の main.tsx に合わせてそのまま残してください。
// （ここではルータだけを安全に切り替えます）
import { BrowserRouter, HashRouter } from "react-router-dom";

/**
 * ルータ自動切替ロジック
 * - 既定: BrowserRouter
 * - 次の条件では HashRouter に自動フォールバックして 404 を回避
 *   - 明示フラグ: import.meta.env.VITE_FORCE_HASH === '1'
 *   - Lovable 等の preview ホスト: hostname が 'preview--' で始まる
 *   - Netlify/Vercel 以外で path-based SPA fallback が効いていないと推測できる場合
 */
function shouldUseHashRouter(): boolean {
  const force = import.meta.env.VITE_FORCE_HASH === "1";
  const host = window.location.hostname || "";
  const isPreview = host.startsWith("preview--"); // Lovable のプレビュー URL 想定
  // 任意: ルートが 404 を返しがちな file/protocol も検知
  const isFileProto = window.location.protocol === "file:";
  return force || isPreview || isFileProto;
}

const RouterComp = shouldUseHashRouter() ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterComp>
      <App />
    </RouterComp>
  </React.StrictMode>
);

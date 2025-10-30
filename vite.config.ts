// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath, URL } from "node:url";

// メモ:
// - tsconfigPaths は tsconfig の "paths" を解決してくれるプラグイン
// - resolve.alias でも冗長に "@" を張っておくとビルド環境差で転ばない
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    tsconfigPaths(),
    // lovable-tagger を使う場合は dev のみ
    // 開発専用: import { componentTagger } from "lovable-tagger";
    // mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // 環境依存の最小化（必要に応じて）
  build: {
    sourcemap: false,
    outDir: "dist",
    emptyOutDir: true,
  },
}));

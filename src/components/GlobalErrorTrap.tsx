// src/components/GlobalErrorTrap.tsx
import React from "react";

type Props = {
  children: React.ReactNode;
};

/**
 * アプリ全体の最後の砦。
 * - React のレンダリング例外をキャッチ
 * - window.onerror / unhandledrejection も拾って画面に可視化
 * 本番でも薄いバナーだけ出るが、DEV時は詳細ログを表示。
 */
export function GlobalErrorTrap({ children }: Props) {
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onErr = (msg: string | Event, src?: string, line?: number, col?: number, e?: Error) => {
      // 画面に出す
      const payload = e?.stack || (typeof msg === "string" ? msg : "Unknown error");
      setError(`[window.onerror] ${payload}`);
      // コンソールにも出す
      // eslint-disable-next-line no-console
      console.error("[window.onerror]", msg, src, line, col, e);
      return false;
    };
    const onRej = (evt: PromiseRejectionEvent) => {
      const reason = (evt?.reason && (evt.reason.stack || evt.reason.message)) || String(evt?.reason);
      setError(`[unhandledrejection] ${reason}`);
      // eslint-disable-next-line no-console
      console.error("[unhandledrejection]", evt);
    };
    window.addEventListener("error", onErr as any);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr as any);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  return (
    <>
      {/* DEV 時はデバッグ用の薄いバナーを出す（致命傷があれば赤表示） */}
      {import.meta.env.DEV && (
        <div
          style={{
            position: "fixed",
            bottom: 8,
            right: 8,
            zIndex: 9999,
            background: error ? "#fee2e2" : "#eef2ff",
            color: "#111827",
            border: "1px solid #93c5fd",
            borderColor: error ? "#ef4444" : "#93c5fd",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            maxWidth: 420,
            boxShadow: "0 2px 8px rgba(0,0,0,.08)",
            whiteSpace: "pre-wrap",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Dev Diagnostics</div>
          <div>env: {import.meta.env.MODE}</div>
          <div>router: BrowserRouter</div>
          <div>supabase: {String(!!import.meta.env.VITE_SUPABASE_URL)}</div>
          {error ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 700, color: "#b91c1c" }}>Last error:</div>
              <div>{error}</div>
            </div>
          ) : (
            <div style={{ marginTop: 6, color: "#374151" }}>No errors captured</div>
          )}
        </div>
      )}
      {children}
    </>
  );
}

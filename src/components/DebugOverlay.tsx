// src/components/DebugOverlay.tsx
import { useEffect, useState } from "react";

type Info = {
  bootHtmlAt?: number;
  bootJsAt?: number;
  errors: string[];
  notes: string[];
};

export default function DebugOverlay() {
  const [open, setOpen] = useState(true);
  const [info, setInfo] = useState<Info>({
    bootHtmlAt: (window as any).__BOOT?.htmlLoadedAt,
    bootJsAt: Date.now(),
    errors: [],
    notes: [],
  });

  useEffect(() => {
    const onErr = (ev: ErrorEvent) => {
      setInfo((s) => ({
        ...s,
        errors: [...s.errors, `[onerror] ${ev.message} at ${ev.filename}:${ev.lineno}:${ev.colno}`],
      }));
    };
    const onRej = (ev: PromiseRejectionEvent) => {
      setInfo((s) => ({
        ...s,
        errors: [...s.errors, `[unhandledrejection] ${String(ev.reason)}`],
      }));
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);

    // 主要エンドポイントの疎通確認（失敗しても表示のみ）
    (async () => {
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        if (url) {
          // /auth/v1/version を軽く叩く（CORSに掛かってもOK：見える化目的）
          await fetch(url.replace(/\/+$/, "") + "/auth/v1/version", { mode: "cors" });
          setInfo((s) => ({ ...s, notes: [...s.notes, "Ping Supabase OK"] }));
        } else {
          setInfo((s) => ({ ...s, notes: [...s.notes, "VITE_SUPABASE_URL is missing"] }));
        }
      } catch (e: any) {
        setInfo((s) => ({ ...s, errors: [...s.errors, `Ping Supabase failed: ${e?.message || String(e)}`] }));
      }
    })();

    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  if (import.meta.env.VITE_DEBUG !== "1") return null;
  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      style={{
        position: "fixed", bottom: 8, right: 8, zIndex: 999999,
        background: "#111", color: "#fff", padding: "6px 10px", borderRadius: 6
      }}
    >
      Debug
    </button>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 8,
        zIndex: 999999,
        background: "rgba(0,0,0,0.72)",
        color: "#fff",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
        padding: 12,
        borderRadius: 8,
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>DEBUG OVERLAY</strong>
        <button onClick={() => setOpen(false)} style={{ background: "#333", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>
          Close
        </button>
      </div>
      <div>HTML loaded: {info.bootHtmlAt ? new Date(info.bootHtmlAt).toISOString() : "(unknown)"}</div>
      <div>JS boot: {info.bootJsAt ? new Date(info.bootJsAt).toISOString() : "(unknown)"}</div>
      <div>ENV: VITE_SUPABASE_URL={String(import.meta.env.VITE_SUPABASE_URL || "(missing)")}</div>
      <div>ENV: VITE_DEBUG={String(import.meta.env.VITE_DEBUG || "0")}</div>
      <hr style={{ borderColor: "#444", margin: "8px 0" }} />
      <div>
        <div style={{ fontWeight: 600 }}>Notes:</div>
        <ul>{info.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
      </div>
      <div>
        <div style={{ fontWeight: 600 }}>Errors:</div>
        <ul>{info.errors.length ? info.errors.map((e, i) => <li key={i}>{e}</li>) : <li>(none yet)</li>}</ul>
      </div>
    </div>
  );
}

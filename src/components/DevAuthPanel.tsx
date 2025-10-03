// src/components/DevAuthPanel.tsx
// DEV専用の薄いオーバーレイで、Auth/Storage/環境の「今」を可視化します。
// 本番ビルドではApp側で表示しないため、機能破壊はありません。
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const boxStyle: React.CSSProperties = {
  position: "fixed",
  right: 12,
  bottom: 12,
  zIndex: 9999,
  fontSize: 12,
  background: "rgba(17,17,17,0.85)",
  color: "#e5e7eb",
  padding: "10px 12px",
  borderRadius: 8,
  maxWidth: 360,
  lineHeight: 1.45,
  boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
};

export default function DevAuthPanel() {
  const { user, session, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [lsKeys, setLsKeys] = useState<string[]>([]);
  const [cookieNames, setCookieNames] = useState<string[]>([]);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (/supabase|sb-|walletconnect|wc@2|appkit/i.test(k)) keys.push(k);
      }
      setLsKeys(keys.sort());
    } catch {}
    try {
      const names = document.cookie
        .split(";")
        .map((s) => s.trim().split("=")[0])
        .filter((n) => n);
      setCookieNames(names);
    } catch {}
  }, [user?.id, session?.access_token, loading]);

  const maskedToken = useMemo(() => {
    const t = session?.access_token ?? "";
    if (!t) return "";
    return t.slice(0, 6) + "..." + t.slice(-4);
  }, [session?.access_token]);

  return (
    <div style={boxStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <strong>🩺 DevAuth</strong>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ color: "#93c5fd", textDecoration: "underline" }}
        >
          {open ? "close" : "open"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 8, maxHeight: 300, overflow: "auto" }}>
          <div>origin: <code>{origin}</code></div>
          <div>loading: <code>{String(loading)}</code></div>
          <div>user: <code>{user?.id ?? "null"}</code></div>
          <div>token: <code>{maskedToken || "none"}</code></div>
          <div style={{ marginTop: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>LocalStorage keys (filtered):</div>
            {lsKeys.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {lsKeys.map((k) => (
                  <li key={k}><code>{k}</code></li>
                ))}
              </ul>
            ) : (
              <div>— none —</div>
            )}
          </div>
          <div style={{ marginTop: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Cookies (names only):</div>
            {cookieNames.length ? (
              <div style={{ wordBreak: "break-all" }}>
                <code>{cookieNames.join(", ")}</code>
              </div>
            ) : (
              <div>— none —</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

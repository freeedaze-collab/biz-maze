// src/pages/auth/Confirm.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function Confirm() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Verifying your email...");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        // URL の ?code= を拾ってセッションを確立（v2 の Email リンクは code の時がある）
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession({ code });
          if (error) throw error;
        } else {
          // すでにログイン済みか確認
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setMsg("Session not found. Please sign in again.");
            return;
          }
        }
        setMsg("Email verified. Redirecting to profile...");
        // 国などの選択は既存の Profile 画面で行う想定
        setTimeout(() => nav("/profile"), 800);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    };
    run();
  }, [nav]);

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Email Confirmation</h1>
      {!err ? <div>{msg}</div> : <div className="text-red-600">{err}</div>}
    </div>
  );
}

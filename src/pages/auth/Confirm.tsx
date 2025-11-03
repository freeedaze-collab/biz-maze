// src/pages/auth/Confirm.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function Confirm() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Verifying session...");

  useEffect(() => {
    (async () => {
      // メールリンクから戻ったらセッションが存在するはず
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setMsg("Email confirmed. Redirecting to profile setup...");
        // ✅ 初回プロフィール設定（/signupform）
        nav("/signupform", { replace: true });
        return;
      }
      setMsg("No active session. Please sign in.");
      nav("/auth/login", { replace: true });
    })();
  }, [nav]);

  return <div className="p-6">{msg}</div>;
}

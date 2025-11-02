// src/pages/auth/Login.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ログイン済みならアプリトップへ
  if (user) {
    nav("/transactions", { replace: true });
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // サインイン後は Transaction History へ
      nav("/transactions", { replace: true });
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  const onBackHome = () => {
    // 未ログイン時に "/" → /auth/login のまま見た目が変わらない問題に対し、
    // Home を「公開トップ（= /auth/login 相当）」と見なして文言だけ残すか、
    // ここでは / へ遷移（RootRedirectの仕様どおり）。
    nav("/", { replace: true });
  };

  return (
    <div className="max-w-sm mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email address"
          className="w-full border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full border rounded px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60"
          disabled={sending}
        >
          {sending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {err && <div className="text-red-600 text-sm whitespace-pre-wrap">{err}</div>}

      <div className="flex items-center justify-between text-sm">
        <button onClick={onBackHome} className="underline text-muted-foreground">
          Back to home
        </button>
        <Link to="/auth/register" className="text-blue-600 underline">
          Create account
        </Link>
      </div>
    </div>
  );
}

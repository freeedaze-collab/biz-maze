// src/pages/auth/EmailSignUp.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function EmailSignUp() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    setErr(null);
    try {
      // メールの確認リンクから戻す先は /auth/confirm
      const redirectTo =
        window.location.origin +
        (window.location.hash ? "/#/auth/confirm" : "/auth/confirm");

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;

      setMsg("We’ve sent a confirmation link to your email.");
      // 案内だけ表示して、その場に留まる（自動遷移しない）
      // 必要なら下の行を解除して /auth/confirm に即時遷移
      // nav("/auth/confirm", { replace: true });
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  const onGoDashboard = () => nav("/dashboard", { replace: true });

  const onSignOut = async () => {
    await supabase.auth.signOut();
    // サインアウト後も /signup のまま（自動遷移しない）
    setMsg("Signed out. You can create a new account now.");
  };

  return (
    <div className="max-w-sm mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="text-sm text-muted-foreground">
        Sign up with your email and password. We’ll send you a confirmation link.
      </p>

      {/* 既にログイン済みの場合は、自動遷移せずにユーザー選択を促す */}
      {user && (
        <div className="rounded border p-3 bg-muted/40">
          <div className="text-sm mb-2">
            You are currently signed in as <span className="font-medium">{user.email ?? user.id}</span>.
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button
              className="px-3 py-2 rounded bg-blue-600 text-white"
              onClick={onGoDashboard}
            >
              Go to Dashboard
            </button>
            <button
              className="px-3 py-2 rounded border"
              onClick={onSignOut}
            >
              Sign out to create a new account
            </button>
          </div>
        </div>
      )}

      {/* サインアップフォーム（常に表示） */}
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
          autoComplete="new-password"
          minLength={6}
        />

        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-60"
          disabled={sending}
        >
          {sending ? "Creating..." : "Create account"}
        </button>
      </form>

      {msg && <div className="text-green-700 text-sm">{msg}</div>}
      {err && <div className="text-red-600 text-sm whitespace-pre-wrap">{err}</div>}

      <div className="text-sm flex items-center justify-between">
        <Link to="/" className="underline text-muted-foreground">
          Back to home
        </Link>
        <Link to="/auth/login" className="text-blue-600 underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}

// src/pages/auth/EmailSignUp.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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

  // すでにログイン済みならアプリトップへ
  if (user) {
    nav("/transactions", { replace: true });
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    setErr(null);
    try {
      const redirectTo =
        window.location.origin +
        (window.location.hash ? "/#/auth/confirm" : "/auth/confirm");

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;

      setMsg("Check your email to confirm your account.");
      // ガイダンスとして confirm ページに寄せる
      nav("/auth/confirm", { replace: true });
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="text-sm text-muted-foreground">
        Sign up with your email address and password.
      </p>

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

      <div className="text-sm">
        Already have an account?{" "}
        <Link to="/auth/login" className="text-blue-600 underline">
          Sign in
        </Link>
      </div>

      <div className="text-sm">
        <Link to="/" className="text-muted-foreground underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}

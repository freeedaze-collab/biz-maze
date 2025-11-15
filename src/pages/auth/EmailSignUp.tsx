// src/pages/auth/EmailSignUp.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function EmailSignUp() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const site =
    import.meta.env.VITE_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          emailRedirectTo: `${site}/auth/confirm`,
        },
      });
      if (error) throw error;
      if (data.user) {
        setMsg(
          "We sent a confirmation link to your email. Please check your inbox (and spam folder)."
        );
      } else {
        setMsg("If this email is valid, a confirmation link has been sent.");
      }
    } catch (e: any) {
      setErr(`Error sending confirmation email: ${e?.message ?? String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-extrabold">Create your account</h1>
      <p className="text-sm text-muted-foreground">
        Sign up with your email and password. We’ll send you a confirmation
        link.
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full border rounded px-3 py-2"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          minLength={6}
        />
        <button
          className="w-full rounded bg-blue-600 text-white py-2 disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? "Creating..." : "Create account"}
        </button>
      </form>

      {msg && <div className="text-green-700 text-sm">{msg}</div>}
      {err && <div className="text-red-600 text-sm">{err}</div>}

      <div className="text-sm">
        <Link to="/auth/login" className="underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
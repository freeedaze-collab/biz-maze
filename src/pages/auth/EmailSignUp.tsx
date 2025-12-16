// src/pages/auth/EmailSignUp.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function EmailSignUp() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (!email || !pw) {
      setErr("Please enter Email and Password.");
      return;
    }
    if (pw !== pw2) {
      setErr("Password does not match.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pw,
      });

      if (error) throw error;

      // If email confirmation is disabled in Supabase, a session is returned directly.
      if (data.session) {
        setMsg("Account created successfully! Redirecting to setup...");
        // Redirect to the onboarding page on successful creation
        nav("/onboarding/entity-and-tax", { replace: true });
      } else {
        // Fallback if email confirmation is still enabled on the backend.
        setMsg("We’ve sent a confirmation link to your email. Please continue from the link.");
        setErr("Note: To sign in directly, the administrator must disable the email confirmation setting in Supabase.");
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Sign up with Email</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Confirm Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? "Sending..." : "Create Account"}
        </button>
      </form>

      {msg && <div className="mt-4 text-green-700">{msg}</div>}
      {err && <div className="mt-4 text-red-600 whitespace-pre-wrap">{err}</div>}
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function EmailSignUp() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signUp({
      email,
      password: pw,
      // 画面側の最小補助のみ。バックエンド・DBは未変更
      options: {
        emailRedirectTo:
          `${import.meta.env.VITE_SITE_URL ?? window.location.origin}/auth/confirm`,
      },
    });
    setBusy(false);
    setMsg(
      error
        ? `Error sending confirmation email: ${error.message}`
        : "Check your inbox for a confirmation link."
    );
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p>Sign up with your email and password. We’ll send you a confirmation link.</p>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Password"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button disabled={busy} className="px-4 py-2 rounded bg-blue-600 text-white">
          {busy ? "Creating..." : "Create account"}
        </button>
      </form>

      {msg && <div className="text-sm text-red-600 whitespace-pre-wrap">{msg}</div>}
      <Link to="/auth/login" className="underline">Back to homeSign in</Link>
    </div>
  );
}

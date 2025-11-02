// src/pages/auth/EmailSignUp.tsx
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function EmailSignUp() {
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
      setErr("Email と Password を入力してください。");
      return;
    }
    if (pw !== pw2) {
      setErr("Password が一致しません。");
      return;
    }

    setLoading(true);
    try {
      // HashRouter を使用しているため、確認後の遷移は /#/auth/confirm に戻す
      const redirectTo = `${window.location.origin}/#/auth/confirm`;

      const { error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        setErr(error.message);
        return;
      }
      setMsg("確認メールを送信しました。受信メールのリンクから続行してください。");
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
      {err && <div className="mt-4 text-red-600">{err}</div>}
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function EmailSignUp() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrMsg(null);

    // Sign up without email confirmation - auto confirm and sign in
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pw,
      options: {
        // Skip email confirmation by not setting emailRedirectTo
        // The user will be auto-logged in after signup
      },
    });

    if (error) {
      setBusy(false);
      setErrMsg(error.message);
      return;
    }

    // If signup successful and session exists, redirect to profile
    if (data.session) {
      navigate("/profile");
    } else {
      // Fallback: try to sign in immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: pw,
      });
      
      if (signInError) {
        setBusy(false);
        setErrMsg("Account created but could not sign in automatically. Please try logging in.");
        return;
      }
      navigate("/profile");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p>Sign up with your email and password.</p>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Password (min 6 characters)"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          minLength={6}
          required
        />
        <button disabled={busy} className="px-4 py-2 rounded bg-blue-600 text-white w-full">
          {busy ? "Creating..." : "Create account"}
        </button>
      </form>

      {errMsg && <div className="text-sm text-red-600 whitespace-pre-wrap">{errMsg}</div>}
      <Link to="/auth/login" className="underline">Already have an account? Sign in</Link>
    </div>
  );
}

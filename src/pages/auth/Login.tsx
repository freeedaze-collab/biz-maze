import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onLogin = async () => {
    setErr(null);
    setBusy(true);
    try {
      if (!email || !password) {
        setErr('Please enter email and password.');
        setBusy(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data?.session) throw new Error('No session returned');

      navigate('/', { replace: true });
    } catch (e: any) {
      const msg = e?.message || e?.error_description || e?.error?.message || 'Login failed';
      setErr(msg);
      console.error('login failed:', e);
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || !email || !password;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-sm text-gray-500">Use your email and password to continue.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              className="w-full border rounded px-3 py-2"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full border rounded px-3 py-2"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            className="w-full px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            onClick={onLogin}
            disabled={disabled}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          {err && <div className="text-red-600 text-sm whitespace-pre-wrap">{err}</div>}
        </div>

        <div className="text-sm text-gray-600">
          <span className="mr-1">No account?</span>
          <Link className="underline" to="/auth/register">Create one</Link>
        </div>

        {/* 開発補助：環境変数警告 */}
        {!import.meta.env.VITE_SUPABASE_URL ||
         !import.meta.env.VITE_SUPABASE_ANON_KEY ? (
          <div className="text-xs rounded bg-red-50 text-red-700 p-3">
            Missing <code>VITE_SUPABASE_URL</code> or <code>VITE_SUPABASE_ANON_KEY</code>. Check your <code>.env</code>.
          </div>
        ) : null}
      </div>
    </div>
  );
}

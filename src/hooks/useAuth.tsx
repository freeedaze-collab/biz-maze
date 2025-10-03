// src/hooks/useAuth.tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初回: セッション取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session ?? null);
      setUser(session?.user ?? null);

      // 任意: サインイン時に profiles 自動作成
      if (event === "SIGNED_IN" && session?.user) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", session.user.id)
          .single();
        if (!existing) {
          await supabase.from("profiles").insert({
            user_id: session.user.id,
            email: session.user.email,
            display_name:
              session.user.user_metadata?.full_name || session.user.email,
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {/* ローディング中は必ず表示 */}
      {loading ? <p className="p-4">Loading session...</p> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

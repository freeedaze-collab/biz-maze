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

// dev専用ロガー（本番では出ません）
const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[Auth]", ...args);
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    devLog("mount: start getSession()");
    supabase.auth.getSession().then(({ data: { session } }) => {
      devLog("getSession() returned:", !!session, session?.user?.id);
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setLoading(false);
      devLog("getSession() state set -> loading=false");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      devLog("onAuthStateChange:", event, "user?", !!session?.user, session?.user?.id);
      setSession(session ?? null);
      setUser(session?.user ?? null);

      // 任意: サインイン時に profiles 自動作成（既存仕様を維持）
      if (event === "SIGNED_IN" && session?.user) {
        try {
          const { data: existing } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", session.user.id)
            .single();
          if (!existing) {
            devLog("profiles: creating for user", session.user.id);
            await supabase.from("profiles").insert({
              user_id: session.user.id,
              email: session.user.email,
              display_name:
                session.user.user_metadata?.full_name || session.user.email,
            });
          }
        } catch (e) {
          devLog("profiles upsert error:", e);
        }
      }
    });

    return () => {
      devLog("unmount: unsubscribe onAuthStateChange");
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    devLog("signOut()");
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {/* ローディング中は必ず表示（空白回避） */}
      {loading ? <p className="p-4">Loading session...</p> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

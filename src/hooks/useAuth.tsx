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

// ▼▼ 追加: DEV時のみログ出力（本番では出ません） ▼▼
const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[Auth]", ...args);
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  devLog("AuthProvider mount");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    devLog("start getSession()");
    supabase.auth.getSession().then(({ data: { session } }) => {
      devLog("getSession() returned:", !!session, session?.user?.id);
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setLoading(false);
      devLog("getSession() state -> loading=false");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      devLog("onAuthStateChange:", event, "user?", !!session?.user, session?.user?.id);
      setSession(session ?? null);
      setUser(session?.user ?? null);

      // 既存仕様: サインイン時に profiles を自動作成
      if (event === "SIGNED_IN" && session?.user) {
        try {
          const { data: existing } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", session.user.id)
            .single();
          if (!existing) {
            devLog("profiles insert for", session.user.id);
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
      devLog("unsubscribe onAuthStateChange");
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    devLog("signOut()");
    await supabase.auth.signOut();
  };

  // ▼▼ 重要: 観測のため loading 中でも children を描画する ▼▼
  // これにより App.tsx 側の DevAuthPanel が常に表示可能になり、データの有無が見えるようになります。
  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {import.meta.env.DEV && loading && (
        <p className="p-4">Loading session...</p>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

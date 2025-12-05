
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
    // STEP 1: まず、現在のセッション情報を、取得する
    const getSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("[Auth] Error getting session:", error);
      }
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setLoading(false); // 重要な、タイミング：セッション取得の、試みが、完了した、時点で、ローディングを、終了する
    };

    getSession();

    // STEP 2: 認証状態の、変化を、監視する
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session ?? null);
        setUser(session?.user ?? null);
        // 認証状態が、変化した、場合も、ローディングは、完了しているはず
        setLoading(false);
      }
    );

    // クリーンアップ関数
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // valueプロパティは、変更なし
  const value = { user, session, loading, signOut };

  // ★★★【最重要修正】★★★
  // ローディング中は、子コンポーネントを、一切、描画しない。
  // これにより、認証が、完了する前に、保護された、ルートが、描画されて、クラッシュするのを、防ぐ。
  return (
    <AuthContext.Provider value={value}>
      {loading ? <div className="p-4">Loading session...</div> : children}
    </AuthContext.Provider>
  );
}

// この、カスタムフックは、変更の、必要なし
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

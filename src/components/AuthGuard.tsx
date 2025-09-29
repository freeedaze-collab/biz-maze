import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);

  useEffect(() => {
    // 未ログイン：プロフィール確認はスキップして即ログイン画面へ
    if (!loading && !user) {
      setProfileLoading(false);
      navigate('/auth/login');
      return;
    }

    // ログイン済み：プロフィール確認
    if (user && !loading) {
      checkAccountSetup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const checkAccountSetup = async () => {
    if (!user) return;
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('account_type, tax_country')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // テーブル未作成などのケースでもガードが固まらないようにログ出しのみ
        console.error('Error checking account setup:', error);
      }

      const setupComplete = !!(profile?.account_type && profile?.tax_country);
      setHasCompletedSetup(setupComplete);

      if (!setupComplete) {
        navigate('/auth/account-setup');
      }
    } catch (err) {
      console.error('Unexpected error checking account setup:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  // 「Loading…」は、(1)全体の認証ロード中 or (2)ログイン済みでプロフィール確認中のみ表示
  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // 未ログイン or セットアップ未完了の場合は、上の useEffect がルーティングするのでここでは描画しない
  if (!user || !hasCompletedSetup) return null;

  return <>{children}</>;
}

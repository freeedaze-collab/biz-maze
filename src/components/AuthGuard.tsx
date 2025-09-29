import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../integrations/supabase/client';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      setProfileLoading(false);
      navigate('/auth/login');
      return;
    }
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

      if (error) console.error('Error checking account setup:', error);

      const ok = !!(profile?.account_type && profile?.tax_country);
      setHasCompletedSetup(ok);
      if (!ok) navigate('/auth/account-setup');
    } catch (err) {
      console.error('Unexpected error checking account setup:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !hasCompletedSetup) return null;

  return <>{children}</>;
}

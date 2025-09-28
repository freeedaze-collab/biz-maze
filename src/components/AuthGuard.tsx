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
    if (!loading && !user) {
      navigate('/auth/login');
      return;
    }

    if (user && !loading) {
      checkAccountSetup();
    }
  }, [user, loading, navigate]);

  const checkAccountSetup = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_type, tax_country')
        .eq('user_id', user.id)
        .single();

      const setupComplete = profile?.account_type && profile?.tax_country;
      setHasCompletedSetup(!!setupComplete);
      
      if (!setupComplete) {
        navigate('/auth/account-setup');
      }
    } catch (error) {
      console.error('Error checking account setup:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  // Show loading while checking authentication and profile
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Only render children if user is authenticated and has completed setup
  if (!user || !hasCompletedSetup) {
    return null;
  }

  return <>{children}</>;
}
// @ts-nocheck
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { User, Wallet, LogOut, Settings } from "lucide-react";

interface UserProfileProps {
  showWalletInfo?: boolean;
}

export const UserProfile = ({ showWalletInfo = true }: UserProfileProps) => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [walletConnections, setWalletConnections] = useState<any[]>([]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      setProfile(profileData);

      if (showWalletInfo) {
        // Fetch wallet connections
        const { data: walletsData } = await supabase
          .from('wallet_connections')
          .select('*')
          .eq('user_id', user.id);
        
        setWalletConnections(walletsData || []);
      }
    };

    fetchUserData();
  }, [user, showWalletInfo]);

  if (!user) return null;

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'User';
  const primaryWallet = walletConnections.find(w => w.is_primary);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-auto px-3 rounded-full">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback>
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">{displayName}</span>
              {showWalletInfo && primaryWallet && (
                <span className="text-xs text-muted-foreground">
                  {primaryWallet.wallet_address.slice(0, 6)}...{primaryWallet.wallet_address.slice(-4)}
                </span>
              )}
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <div className="flex flex-col space-y-1 p-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback>
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground mt-1">
                {user.email}
              </p>
            </div>
          </div>
          
          {showWalletInfo && walletConnections.length > 0 && (
            <Card className="mt-2">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4" />
                  <span className="text-sm font-medium">Connected Wallets</span>
                </div>
                <div className="space-y-1">
                  {walletConnections.slice(0, 2).map((wallet) => (
                    <div key={wallet.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">
                          {wallet.wallet_address.slice(0, 6)}...{wallet.wallet_address.slice(-4)}
                        </span>
                        {wallet.is_primary && (
                          <Badge variant="secondary" className="text-xs">Primary</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {wallet.wallet_type}
                      </span>
                    </div>
                  ))}
                  {walletConnections.length > 2 && (
                    <p className="text-xs text-muted-foreground">
                      +{walletConnections.length - 2} more wallets
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
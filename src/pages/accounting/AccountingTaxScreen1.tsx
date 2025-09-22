import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, RefreshCw } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import USTaxCalculator from "@/components/USTaxCalculator";
import IFRSReport from "@/components/IFRSReport";

const AccountingTaxScreen1 = () => {
  const { user } = useAuth();
  const { wallets } = useWallet();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          wallet_connections!inner(wallet_type, wallet_name)
        `)
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch transaction history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const syncAllWallets = async () => {
    if (wallets.length === 0) return;
    
    setLoading(true);
    try {
      for (const wallet of wallets) {
        await supabase.functions.invoke('sync-wallet-balance', {
          body: { walletId: wallet.id }
        });
      }
      await fetchTransactions();
      toast({
        title: "Success",
        description: "All wallet transactions synced",
      });
    } catch (error) {
      console.error('Error syncing wallets:', error);
      toast({
        title: "Error",
        description: "Failed to sync wallet data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>
        
        <Navigation />
        
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Accounting & Tax Reports</h1>
              <p className="text-muted-foreground mt-2">
                Generate comprehensive reports for your cryptocurrency transactions and tax obligations.
              </p>
            </div>
            <Button onClick={syncAllWallets} disabled={loading || wallets.length === 0}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Sync Wallets
            </Button>
          </div>

          {/* Connected Wallets Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wallet className="mr-2 h-5 w-5" />
                Connected Wallets
              </CardTitle>
              <CardDescription>
                {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} connected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {wallets.map((wallet) => (
                  <div key={wallet.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Wallet className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{wallet.wallet_name || wallet.wallet_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {wallet.wallet_address.substring(0, 6)}...{wallet.wallet_address.substring(-4)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${wallet.balance_usd.toFixed(2)}</p>
                      {wallet.is_primary && <Badge variant="secondary">Primary</Badge>}
                    </div>
                  </div>
                ))}
                {wallets.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    No wallets connected. <Link to="/wallet/creation" className="text-primary hover:underline">Connect a wallet</Link>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.transaction_type === 'send' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {tx.transaction_type === 'send' ? '↗' : '↙'}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{tx.transaction_type} {tx.currency}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(tx.transaction_date).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {tx.transaction_type === 'send' ? '-' : '+'}{tx.amount} {tx.currency}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${tx.usd_value?.toFixed(2) || '0.00'}
                      </p>
                      <Badge variant={tx.transaction_status === 'confirmed' ? 'default' : 'secondary'}>
                        {tx.transaction_status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    {loading ? "Loading transactions..." : "No transactions found"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reports Section */}
          <div className="space-y-6">
            {user && <USTaxCalculator userId={user.id} />}
            {user && <IFRSReport userId={user.id} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountingTaxScreen1;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TransactionHistory = () => {
  const { user } = useAuth();
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
        .order('transaction_date', { ascending: false })
        .limit(50);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard",
    });
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
              <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
              <p className="text-muted-foreground mt-2">
                Complete history of all your cryptocurrency transactions from connected wallets
              </p>
            </div>
            <Button onClick={fetchTransactions} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading transactions...</p>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No transactions found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      <Link to="/wallet/creation" className="text-primary hover:underline">Connect a wallet</Link> to see your transaction history
                    </p>
                  </div>
                ) : (
                  transactions.map((transaction) => (
                    <div key={transaction.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-full ${
                            transaction.transaction_type === 'send' 
                              ? 'bg-red-100 text-red-600' 
                              : 'bg-green-100 text-green-600'
                          }`}>
                            {transaction.transaction_type === 'send' ? 
                              <ArrowUpRight className="h-4 w-4" /> : 
                              <ArrowDownLeft className="h-4 w-4" />
                            }
                          </div>
                          <div>
                            <p className="font-medium capitalize">
                              {transaction.transaction_type === 'send' ? 'Sent' : 'Received'} {transaction.currency}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(transaction.transaction_date).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              via {transaction.wallet_connections?.wallet_name || transaction.wallet_connections?.wallet_type}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">
                            {transaction.transaction_type === 'send' ? '-' : '+'}{transaction.amount} {transaction.currency}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            ${transaction.usd_value?.toLocaleString() || '0.00'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Badge variant={transaction.transaction_status === 'confirmed' ? 'default' : 'secondary'}>
                          {transaction.transaction_status}
                        </Badge>
                        <div className="flex space-x-2">
                          {transaction.transaction_hash && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(transaction.transaction_hash)}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy Hash
                            </Button>
                          )}
                          {transaction.transaction_hash && (
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View on Explorer
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">From</p>
                          <p className="font-mono break-all text-xs">{transaction.from_address || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">To</p>
                          <p className="font-mono break-all text-xs">{transaction.to_address || 'N/A'}</p>
                        </div>
                        {transaction.gas_fee && (
                          <>
                            <div>
                              <p className="text-muted-foreground">Gas Fee</p>
                              <p>{transaction.gas_fee} {transaction.currency}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Gas Fee (USD)</p>
                              <p>${transaction.gas_fee_usd?.toFixed(2) || '0.00'}</p>
                            </div>
                          </>
                        )}
                        <div>
                          <p className="text-muted-foreground">Network</p>
                          <p className="capitalize">{transaction.blockchain_network}</p>
                        </div>
                        {transaction.block_number && (
                          <div>
                            <p className="text-muted-foreground">Block</p>
                            <p>{transaction.block_number}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;
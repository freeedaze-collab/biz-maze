import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Wallet, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ExchangeServices = () => {
  const [portfolio, setPortfolio] = useState([
    { symbol: "BTC", amount: "0.05", value: "$2,150.00", change: "+5.2%" },
    { symbol: "ETH", amount: "2.45", value: "$3,920.50", change: "+3.1%" },
    { symbol: "USDC", amount: "1,250.00", value: "$1,250.00", change: "0%" },
  ]);
  
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [selectedCrypto, setSelectedCrypto] = useState("");
  const [transactions, setTransactions] = useState([
    { id: 1, type: "buy", crypto: "BTC", amount: "0.01", price: "$43,000", date: "2024-01-15", status: "completed" },
    { id: 2, type: "sell", crypto: "ETH", amount: "0.5", price: "$1,600", date: "2024-01-14", status: "completed" },
    { id: 3, type: "buy", crypto: "USDC", amount: "500", price: "$1.00", date: "2024-01-13", status: "pending" },
  ]);

  const { toast } = useToast();

  const handleBuy = () => {
    if (!selectedCrypto || !buyAmount) {
      toast({
        title: "Error",
        description: "Please select a cryptocurrency and enter an amount",
        variant: "destructive",
      });
      return;
    }

    const newTransaction = {
      id: transactions.length + 1,
      type: "buy" as const,
      crypto: selectedCrypto,
      amount: buyAmount,
      price: selectedCrypto === "BTC" ? "$43,500" : selectedCrypto === "ETH" ? "$1,620" : "$1.00",
      date: new Date().toISOString().split('T')[0],
      status: "pending" as const,
    };

    setTransactions([newTransaction, ...transactions]);
    setBuyAmount("");
    setSelectedCrypto("");

    toast({
      title: "Buy Order Placed",
      description: `Successfully placed buy order for ${buyAmount} ${selectedCrypto}`,
    });
  };

  const handleSell = () => {
    if (!selectedCrypto || !sellAmount) {
      toast({
        title: "Error",
        description: "Please select a cryptocurrency and enter an amount",
        variant: "destructive",
      });
      return;
    }

    const newTransaction = {
      id: transactions.length + 1,
      type: "sell" as const,
      crypto: selectedCrypto,
      amount: sellAmount,
      price: selectedCrypto === "BTC" ? "$43,500" : selectedCrypto === "ETH" ? "$1,620" : "$1.00",
      date: new Date().toISOString().split('T')[0],
      status: "pending" as const,
    };

    setTransactions([newTransaction, ...transactions]);
    setSellAmount("");
    setSelectedCrypto("");

    toast({
      title: "Sell Order Placed",
      description: `Successfully placed sell order for ${sellAmount} ${selectedCrypto}`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/management/portfolio" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Portfolio
          </Link>
        </div>

        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Cryptoasset Exchange Services</h1>

          {/* Portfolio Overview */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Portfolio Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {portfolio.map((asset, index) => (
                  <div key={index} className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{asset.symbol}</h3>
                      <span className={`text-sm ${asset.change.startsWith('+') ? 'text-success' : asset.change === '0%' ? 'text-muted-foreground' : 'text-destructive'}`}>
                        {asset.change}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{asset.amount} {asset.symbol}</p>
                    <p className="text-lg font-medium">{asset.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="trade" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trade">Trade</TabsTrigger>
              <TabsTrigger value="history">Transaction History</TabsTrigger>
              <TabsTrigger value="account">Account Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="trade" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Buy Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-success">
                      <TrendingUp className="h-5 w-5" />
                      Buy Cryptocurrency
                    </CardTitle>
                    <CardDescription>Purchase crypto assets</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="buy-crypto">Select Cryptocurrency</Label>
                      <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose crypto to buy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                          <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                          <SelectItem value="USDC">USD Coin (USDC)</SelectItem>
                          <SelectItem value="ADA">Cardano (ADA)</SelectItem>
                          <SelectItem value="SOL">Solana (SOL)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="buy-amount">Amount</Label>
                      <Input
                        id="buy-amount"
                        type="number"
                        placeholder="Enter amount to buy"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                      />
                    </div>

                    <Button onClick={handleBuy} className="w-full">
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Place Buy Order
                    </Button>
                  </CardContent>
                </Card>

                {/* Sell Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <TrendingDown className="h-5 w-5" />
                      Sell Cryptocurrency
                    </CardTitle>
                    <CardDescription>Sell your crypto assets</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="sell-crypto">Select Cryptocurrency</Label>
                      <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose crypto to sell" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                          <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                          <SelectItem value="USDC">USD Coin (USDC)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="sell-amount">Amount</Label>
                      <Input
                        id="sell-amount"
                        type="number"
                        placeholder="Enter amount to sell"
                        value={sellAmount}
                        onChange={(e) => setSellAmount(e.target.value)}
                      />
                    </div>

                    <Button onClick={handleSell} variant="destructive" className="w-full">
                      <TrendingDown className="mr-2 h-4 w-4" />
                      Place Sell Order
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Transaction History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${transaction.type === 'buy' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                            {transaction.type === 'buy' ? 
                              <TrendingUp className={`h-4 w-4 text-success`} /> : 
                              <TrendingDown className={`h-4 w-4 text-destructive`} />
                            }
                          </div>
                          <div>
                            <p className="font-medium">
                              {transaction.type === 'buy' ? 'Bought' : 'Sold'} {transaction.amount} {transaction.crypto}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              at {transaction.price} on {transaction.date}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            transaction.status === 'completed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                          }`}>
                            {transaction.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Exchange Account Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Account Status</h3>
                    <p className="text-sm text-muted-foreground mb-2">Your exchange account is fully verified and active</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-success rounded-full"></div>
                      <span className="text-sm text-success">Active</span>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Trading Limits</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Daily Buy Limit:</span>
                        <span>$10,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Daily Sell Limit:</span>
                        <span>$10,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Monthly Limit:</span>
                        <span>$100,000</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Connected Wallets</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">MetaMask Wallet</span>
                        <span className="text-xs text-success">Connected</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Bank Account (****1234)</span>
                        <span className="text-xs text-success">Verified</span>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full">
                    Update Account Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ExchangeServices;
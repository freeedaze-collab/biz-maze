
// @ts-nocheck
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const fetchHoldings = async () => {
  const { data, error } = await supabase.from("v_holdings").select("*");
  if (error) {
    throw new Error(error.message);
  }
  return data;
};

const fetchTransactions = async () => {
  const { data, error } = await supabase.from("v_all_transactions").select("*");
  if (error) {
    throw new Error(error.message);
  }
  return data;
};

const TransactionHistoryScreen1 = () => {
  const {
    data: holdings,
    isLoading: isLoadingHoldings,
    error: errorHoldings,
  } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
  });

  const {
    data: transactions,
    isLoading: isLoadingTransactions,
    error: errorTransactions,
  } = useQuery({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">
            Transactions
          </h1>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-card-foreground mb-4">
              Data Sync
            </h2>
            <p className="text-muted-foreground mb-4">
              Manually sync the latest transaction history from your connected
              sources.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Wallet (ethereum)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button>Sync</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>All Connected Exchanges</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-4">
                  <Button>Sync All</Button>
                  <Link
                    to="/management/exchange-services"
                    className="text-sm text-primary hover:underline"
                  >
                    Manage API Keys
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Average Cost</TableHead>
                    <TableHead>Current Value</TableHead>
                    <TableHead>Unrealized Gain/Loss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingHoldings ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : errorHoldings ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-red-500"
                      >
                        Error: {errorHoldings.message}
                      </TableCell>
                    </TableRow>
                  ) : (
                    holdings?.map((holding) => (
                      <TableRow key={holding.asset}>
                        <TableCell>{holding.asset}</TableCell>
                        <TableCell>{holding.current_amount}</TableCell>
                        <TableCell>{holding.average_buy_price}</TableCell>
                        <TableCell>{holding.total_cost}</TableCell>
                        <TableCell>{holding.realized_pnl}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Asset</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTransactions ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : errorTransactions ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-red-500"
                      >
                        Error: {errorTransactions.message}
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions?.map((tx) => (
                      <TableRow key={tx.ctx_id}>
                        <TableCell>{new Date(tx.ts).toLocaleString()}</TableCell>
                        <TableCell>{tx.source}</TableCell>
                        <TableCell>{tx.symbol}</TableCell>
                        <TableCell>{tx.amount}</TableCell>
                        <TableCell>{tx.asset}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistoryScreen1;

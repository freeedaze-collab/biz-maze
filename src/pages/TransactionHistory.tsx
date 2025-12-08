// @ts-nocheck
import { Link } from "react-router-dom";
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

const TransactionHistoryScreen1 = () => {
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
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      Holdings data will be displayed here.
                    </TableCell>
                  </TableRow>
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
                  <TableRow>
                    <TableCell>2025/12/7 23:01:13</TableCell>
                    <TableCell>exchange</TableCell>
                    <TableCell>BTC/JPY</TableCell>
                    <TableCell>1200</TableCell>
                    <TableCell>BTC</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2025/11/27 1:42:47</TableCell>
                    <TableCell>wallet</TableCell>
                    <TableCell>ETH</TableCell>
                    <TableCell>0.0018</TableCell>
                    <TableCell>ETH</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2025/11/27 1:42:13</TableCell>
                    <TableCell>exchange</TableCell>
                    <TableCell>ETH</TableCell>
                    <TableCell>0.0018</TableCell>
                    <TableCell>ETH</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2025/11/27 1:39:04</TableCell>
                    <TableCell>exchange</TableCell>
                    <TableCell>ETH/JPY</TableCell>
                    <TableCell>0.00210254</TableCell>
                    <TableCell>ETH</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2025/11/26 23:08:48</TableCell>
                    <TableCell>exchange</TableCell>
                    <TableCell>BTC/JPY</TableCell>
                    <TableCell>0.00021387</TableCell>
                    <TableCell>BTC</TableCell>
                  </TableRow>
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

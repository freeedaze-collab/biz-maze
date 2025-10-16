// src/pages/Dashboard.tsx
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Send money</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Start manual transfer flow and confirm the payment.
            </p>
            <Button asChild><Link to="/transfer/start">Start transfer</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Create invoice</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Prepare an invoice (save company/client, add line items).
            </p>
            <Button asChild variant="outline"><Link to="/invoice/new">Create invoice</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Accounting / Tax</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Generate journal entries, P/L, trial balance and US tax estimate.
            </p>
            <Button asChild variant="outline"><Link to="/accounting">Open</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">View synchronized on-chain history.</p>
            <Button asChild variant="outline"><Link to="/transactions">Open</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Check your plan and metered fees.</p>
            <Button asChild variant="outline"><Link to="/pricing">Open</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Update country and entity type.</p>
            <Button asChild variant="outline"><Link to="/profile">Open</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

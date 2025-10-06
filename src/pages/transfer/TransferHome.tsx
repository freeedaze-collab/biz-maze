// src/pages/transfer/TransferHome.tsx
import Navigation from "@/components/Navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function TransferHome() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="max-w-3xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Transfer (ETH)</CardTitle>
              <CardDescription>Choose how to send:</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              <Button asChild><Link to="/transfer/new">New recipient</Link></Button>
              <Button asChild variant="secondary"><Link to="/transfer/existing">Existing client</Link></Button>
              <Button asChild variant="outline"><Link to="/transfer/from-invoice">Pay from invoice</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

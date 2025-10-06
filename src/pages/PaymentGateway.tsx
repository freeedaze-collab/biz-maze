// src/pages/payment/PaymentGateway.tsx
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PaymentGateway() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Navigation />
        <div className="max-w-3xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Payment Gateway</CardTitle>
              <CardDescription>Integration settings will be available here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Coming soon: card processors, onramp/offramp, and webhooks.
              </p>
              <Button disabled>Connect (coming soon)</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

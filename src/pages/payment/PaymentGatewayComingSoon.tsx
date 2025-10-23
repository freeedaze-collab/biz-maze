// @ts-nocheck
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Bell } from "lucide-react";

const PaymentGatewayComingSoon = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-3xl">Payment Gateway</CardTitle>
              <CardDescription className="text-lg">
                Will be available soon
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 p-6 rounded-lg">
                <h3 className="font-semibold mb-2">Coming Soon Features:</h3>
                <ul className="text-left space-y-2 text-muted-foreground">
                  <li>• Stripe Integration</li>
                  <li>• PayPal Support</li>
                  <li>• Cryptocurrency Payments</li>
                  <li>• Bank Transfer Processing</li>
                  <li>• Multi-currency Support</li>
                  <li>• Real-time Payment Tracking</li>
                </ul>
              </div>

              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Bell className="h-4 w-4" />
                <span className="text-sm">We'll notify you when this feature is ready</span>
              </div>

              <Button variant="outline" asChild>
                <Link to="/">Return to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentGatewayComingSoon;
// @ts-nocheck
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Link as LinkIcon } from "lucide-react";

const PaymentGatewayScreen1 = () => {
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
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Payment Gateway Setup</h1>

          <div className="space-y-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-primary" />
                  Implement a Payment System
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Set up a new payment system from scratch with custom configurations
                </p>
                <Link to="/payment-gateway/implement">
                  <Button className="w-full">
                    Implement New System
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <LinkIcon className="h-6 w-6 text-primary" />
                  Integrate an Existing Payment System
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Connect to an existing payment provider or service
                </p>
                <Link to="/payment-gateway/integrate">
                  <Button variant="outline" className="w-full">
                    Integrate Existing System
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentGatewayScreen1;
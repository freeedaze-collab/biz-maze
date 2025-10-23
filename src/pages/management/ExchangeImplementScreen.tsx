// @ts-nocheck
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet } from "lucide-react";

const ExchangeImplementScreen = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/management/portfolio" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Portfolio
          </Link>
        </div>

        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Select Wallet Provider</h1>
          
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Wallet className="h-6 w-6 text-primary" />
                  MetaMask
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Connect with MetaMask wallet for crypto asset exchange
                </p>
                <Link to="/management/exchange/connect">
                  <Button className="w-full">
                    Select MetaMask
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Wallet className="h-6 w-6 text-primary" />
                  BitPay
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Connect with BitPay for comprehensive crypto services
                </p>
                <Link to="/management/exchange/connect">
                  <Button variant="outline" className="w-full">
                    Select BitPay
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

export default ExchangeImplementScreen;
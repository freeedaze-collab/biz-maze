// @ts-nocheck
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle, Home, Mail } from "lucide-react";

const WithdrawalConfirmation = () => {
  const withdrawal = {
    id: "WD-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
    amount: "$1,500.00",
    method: "Bank Transfer",
    account: "**** **** **** 1234",
    status: "pending",
    requestDate: new Date().toLocaleDateString(),
    estimatedCompletion: "2-3 business days",
    progress: 25,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Withdrawal Confirmation
          </h1>
          <p className="text-muted-foreground text-lg">
            Your withdrawal request has been submitted
          </p>
        </div>

        <Navigation />

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Confirmation Status */}
          <Card className="border-warning/20 bg-warning/5">
            <CardContent className="pt-6">
              <div className="text-center">
                <Clock className="h-16 w-16 text-warning mx-auto mb-4 animate-pulse" />
                <h2 className="text-2xl font-bold text-warning mb-2">
                  Withdrawal Pending
                </h2>
                <p className="text-muted-foreground mb-4">
                  Your withdrawal request is being reviewed
                </p>
                <div className="space-y-2">
                  <Progress value={withdrawal.progress} className="w-full" />
                  <p className="text-sm text-muted-foreground">
                    Processing step 1 of 4
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Withdrawal Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Withdrawal Details
              </CardTitle>
              <CardDescription>
                Keep this information for your records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Withdrawal ID:</span>
                  <span className="font-medium">{withdrawal.id}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold text-lg">{withdrawal.amount}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="font-medium">{withdrawal.method}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Destination:</span>
                  <span className="font-medium">{withdrawal.account}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Request Date:</span>
                  <span className="font-medium">{withdrawal.requestDate}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Estimated Completion:</span>
                  <span className="font-medium">{withdrawal.estimatedCompletion}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Process Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Processing Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-success rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Request Submitted</p>
                    <p className="text-sm text-muted-foreground">Your withdrawal request has been received</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-warning rounded-full mt-2 animate-pulse"></div>
                  <div>
                    <p className="font-medium">Security Review</p>
                    <p className="text-sm text-muted-foreground">Currently under security verification</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Processing</p>
                    <p className="text-sm text-muted-foreground">Funds will be transferred</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium">Completed</p>
                    <p className="text-sm text-muted-foreground">Funds delivered to destination</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Notification */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-primary mb-1">Email Notifications</p>
                  <p className="text-muted-foreground">
                    We'll send you email updates at each step of the withdrawal process. 
                    Check your inbox for confirmation and status updates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Link to="/" className="flex-1">
              <Button variant="outline" className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
            </Link>
            <Link to="/transaction-history" className="flex-1">
              <Button className="w-full">
                View Transaction History
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalConfirmation;
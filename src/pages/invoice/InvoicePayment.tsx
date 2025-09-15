import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, CreditCard, Wallet, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const InvoicePayment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [loading, setLoading] = useState(false);

  const invoice = {
    id: id || "INV-001",
    amount: "$1,234.56",
    description: "Web Development Services",
  };

  const handlePayment = async () => {
    setLoading(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Payment Processing",
        description: "Your payment is being processed...",
      });
      navigate(`/invoice/${id}/completion`);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to={`/invoice/${id}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Details
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Payment Confirmation
          </h1>
          <p className="text-muted-foreground text-lg">
            Complete payment for Invoice {invoice.id}
          </p>
        </div>

        <Navigation />

        <div className="max-w-2xl mx-auto space-y-6">
          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
              <CardDescription>{invoice.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Amount:</span>
                  <span className="text-2xl font-bold">{invoice.amount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="card" id="card" />
                  <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                    <CreditCard className="h-4 w-4" />
                    Credit/Debit Card
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value="wallet" id="wallet" />
                  <Label htmlFor="wallet" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Wallet className="h-4 w-4" />
                    Digital Wallet
                  </Label>
                </div>
              </RadioGroup>

              {paymentMethod === "card" && (
                <div className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input id="cardNumber" placeholder="1234 5678 9012 3456" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expiry">Expiry Date</Label>
                      <Input id="expiry" placeholder="MM/YY" />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV</Label>
                      <Input id="cvv" placeholder="123" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="cardName">Cardholder Name</Label>
                    <Input id="cardName" placeholder="John Doe" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Notice */}
          <Card className="border-success/20 bg-success/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-success">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Your payment is secured with 256-bit SSL encryption
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Confirm Payment */}
          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={handlePayment} 
                className="w-full" 
                size="lg"
                disabled={loading}
              >
                {loading ? "Processing..." : `Confirm Payment - ${invoice.amount}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InvoicePayment;
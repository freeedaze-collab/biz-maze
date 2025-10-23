// @ts-nocheck
import { useParams, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CreditCard, Calendar, DollarSign, FileText } from "lucide-react";

const InvoiceDetails = () => {
  const { id } = useParams();

  const invoice = {
    id: id || "INV-001",
    amount: "$1,234.56",
    status: "unpaid",
    dueDate: "2024-01-15",
    issueDate: "2023-12-15",
    description: "Web Development Services",
    items: [
      { description: "Frontend Development", quantity: 40, rate: "$25.00", total: "$1,000.00" },
      { description: "Backend Integration", quantity: 15, rate: "$15.64", total: "$234.56" },
    ],
    subtotal: "$1,234.56",
    tax: "$0.00",
    total: "$1,234.56"
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/billing">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoices
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Invoice Details
          </h1>
          <p className="text-muted-foreground text-lg">
            Invoice {invoice.id}
          </p>
        </div>

        <Navigation />

        <div className="space-y-6">
          {/* Invoice Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {invoice.id}
                  </CardTitle>
                  <CardDescription>{invoice.description}</CardDescription>
                </div>
                <Badge
                  variant={invoice.status === 'paid' ? 'default' : 'destructive'}
                  className={invoice.status === 'paid' ? 'bg-success hover:bg-success/90' : ''}
                >
                  {invoice.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Issue Date</p>
                    <p className="text-sm text-muted-foreground">{invoice.issueDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Due Date</p>
                    <p className="text-sm text-muted-foreground">{invoice.dueDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Total Amount</p>
                    <p className="text-lg font-bold">{invoice.total}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoice.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity} × {item.rate}
                      </p>
                    </div>
                    <p className="font-semibold">{item.total}</p>
                  </div>
                ))}
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{invoice.subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>{invoice.tax}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>{invoice.total}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <Link to={`/invoice/${invoice.id}/payment`} className="flex-1">
                  <Button className="w-full" size="lg">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Proceed to Payment
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetails;
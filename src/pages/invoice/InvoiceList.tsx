// @ts-nocheck
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Calendar, DollarSign } from "lucide-react";

const InvoiceList = () => {
  const invoices = [
    {
      id: "INV-001",
      amount: "$1,234.56",
      status: "unpaid",
      dueDate: "2024-01-15",
      description: "Web Development Services",
    },
    {
      id: "INV-002", 
      amount: "$2,567.89",
      status: "paid",
      dueDate: "2024-01-10",
      description: "Monthly Subscription",
    },
    {
      id: "INV-003",
      amount: "$789.12",
      status: "unpaid",
      dueDate: "2024-01-20",
      description: "Consulting Services",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Billing & Invoices
          </h1>
          <p className="text-muted-foreground text-lg">
            Manage your invoices and billing information
          </p>
        </div>

        <Navigation />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Invoice List
            </CardTitle>
            <CardDescription>
              View and manage all your invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{invoice.id}</h3>
                      <Badge
                        variant={invoice.status === 'paid' ? 'default' : 'destructive'}
                        className={invoice.status === 'paid' ? 'bg-success hover:bg-success/90' : ''}
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-1">{invoice.description}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {invoice.amount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {invoice.dueDate}
                      </span>
                    </div>
                  </div>
                  
                  <Link to={`/invoice/${invoice.id}`}>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InvoiceList;
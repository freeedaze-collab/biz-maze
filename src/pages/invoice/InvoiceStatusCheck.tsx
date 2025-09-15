import { useState } from "react";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Search, Eye, CreditCard, Receipt, Calendar, DollarSign } from "lucide-react";

const InvoiceStatusCheck = () => {
  const [searchId, setSearchId] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);

  // Sample invoice data for demo
  const invoiceDatabase = {
    "INV-001": {
      id: "INV-001",
      status: "unpaid",
      amount: "$1,234.56",
      dueDate: "2024-01-15",
      issueDate: "2023-12-15",
      description: "Web Development Services",
      client: "ABC Corporation",
    },
    "INV-002": {
      id: "INV-002",
      status: "paid",
      amount: "$2,567.89",
      dueDate: "2024-01-10",
      issueDate: "2023-12-10",
      description: "Monthly Subscription",
      client: "XYZ Ltd",
      paidDate: "2024-01-08",
      paymentMethod: "Credit Card",
    },
    "INV-003": {
      id: "INV-003",
      status: "overdue",
      amount: "$789.12",
      dueDate: "2024-01-05",
      issueDate: "2023-12-05",
      description: "Consulting Services",
      client: "Tech Startup Inc",
    },
  };

  const handleSearch = () => {
    const result = invoiceDatabase[searchId as keyof typeof invoiceDatabase];
    setSearchResult(result || null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-success hover:bg-success/90';
      case 'unpaid': return 'bg-warning hover:bg-warning/90';
      case 'overdue': return 'bg-destructive hover:bg-destructive/90';
      default: return '';
    }
  };

  const sampleInvoices = [
    { id: "INV-001", status: "unpaid", amount: "$1,234.56", dueDate: "2024-01-15" },
    { id: "INV-002", status: "paid", amount: "$2,567.89", dueDate: "2024-01-10" },
    { id: "INV-003", status: "overdue", amount: "$789.12", dueDate: "2024-01-05" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-card-foreground mb-2">
            Invoice Status Check
          </h1>
          <p className="text-muted-foreground text-lg">
            Check the payment status of any invoice
          </p>
        </div>

        <Navigation />

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Search Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Invoice Lookup
              </CardTitle>
              <CardDescription>
                Enter an invoice ID to check its current status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="invoiceId">Invoice ID</Label>
                  <Input
                    id="invoiceId"
                    placeholder="Enter invoice ID (e.g., INV-001)"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleSearch} disabled={!searchId}>
                    <Search className="h-4 w-4 mr-2" />
                    Check Status
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Result */}
          {searchResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Invoice Found
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{searchResult.id}</h3>
                        <Badge
                          variant="secondary"
                          className={getStatusColor(searchResult.status)}
                        >
                          {searchResult.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mb-2">{searchResult.description}</p>
                      <p className="text-sm text-muted-foreground">Client: {searchResult.client}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {searchResult.amount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {searchResult.dueDate}
                        </span>
                        {searchResult.paidDate && (
                          <span className="flex items-center gap-1">
                            <Receipt className="h-3 w-3" />
                            Paid: {searchResult.paidDate}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Link to={`/invoice/${searchResult.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </Link>
                      
                      {searchResult.status === 'unpaid' && (
                        <Link to={`/invoice/${searchResult.id}/payment`}>
                          <Button size="sm">
                            <CreditCard className="h-4 w-4 mr-2" />
                            Pay Now
                          </Button>
                        </Link>
                      )}
                      
                      {searchResult.status === 'paid' && (
                        <Button variant="outline" size="sm">
                          <Receipt className="h-4 w-4 mr-2" />
                          View Receipt
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Issue Date</p>
                      <p className="font-medium">{searchResult.issueDate}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Due Date</p>
                      <p className="font-medium">{searchResult.dueDate}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="font-bold">{searchResult.amount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge
                        variant="secondary"
                        className={getStatusColor(searchResult.status)}
                      >
                        {searchResult.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {searchId && !searchResult && searchId !== "" && (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="text-center">
                  <FileCheck className="h-12 w-12 text-destructive mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-destructive mb-2">
                    Invoice Not Found
                  </h3>
                  <p className="text-muted-foreground">
                    No invoice found with ID "{searchId}". Please check the ID and try again.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sample Invoices */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>
                Quick access to recent invoices - click to check status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sampleInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSearchId(invoice.id);
                      setSearchResult(invoiceDatabase[invoice.id as keyof typeof invoiceDatabase]);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <FileCheck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{invoice.id}</p>
                        <p className="text-sm text-muted-foreground">Due: {invoice.dueDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{invoice.amount}</span>
                      <Badge
                        variant="secondary"
                        className={getStatusColor(invoice.status)}
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InvoiceStatusCheck;
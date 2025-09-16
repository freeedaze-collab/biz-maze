import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { InvoiceGenerator } from "@/components/InvoiceGenerator";

const RequestScreen2_2 = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/request" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Request
          </Link>
        </div>

        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Select Recipient</h1>
          
          <div className="mb-6">
            <Link to="/request/recipients">
              <Button className="w-full">
                View All Recipients
              </Button>
            </Link>
          </div>
          
          <InvoiceGenerator 
            existingRecipient={{
              name: "Sample Client",
              email: "client@example.com", 
              address: "123 Client St",
              city: "Client City",
              state: "CS",
              zip: "12345",
              country: "United States"
            }}
            onSaveRecipient={(recipient) => {
              console.log('Updating recipient:', recipient);
            }}
            onInvoiceGenerated={(invoiceData) => {
              console.log('Invoice generated with existing recipient:', invoiceData);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default RequestScreen2_2;
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { InvoiceGenerator } from "@/components/InvoiceGenerator";

const RequestScreen2 = () => {
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
          <h1 className="text-4xl font-bold text-card-foreground mb-8">New Payment Request</h1>
          
          <InvoiceGenerator 
            onSaveRecipient={(recipient) => {
              // Save recipient to local storage or database
              console.log('Saving recipient:', recipient);
            }}
            onInvoiceGenerated={(invoiceData) => {
              // Handle invoice generation
              console.log('Invoice generated:', invoiceData);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default RequestScreen2;
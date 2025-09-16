import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

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

        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">New Payment Request</h1>
          
          <div className="w-full h-[700px] border rounded-lg">
            <iframe
              src="https://cryptoinvoice.new/"
              title="Crypto Invoice Generator"
              className="w-full h-full rounded-lg"
              frameBorder="0"
              allow="clipboard-write"
            />
          </div>
          
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Create professional crypto invoices with CryptoInvoice
          </p>
        </div>
      </div>
    </div>
  );
};

export default RequestScreen2;
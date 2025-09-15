import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

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

        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Existing Recipients</h1>
          
          <div className="w-full h-[600px] border rounded-lg">
            <iframe
              src="https://example.com/existing-recipients"
              title="Existing Recipients"
              className="w-full h-full rounded-lg"
              frameBorder="0"
            />
          </div>
          
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Existing recipients list will be loaded here
          </p>
        </div>
      </div>
    </div>
  );
};

export default RequestScreen2_2;
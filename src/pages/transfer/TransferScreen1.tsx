import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, FileText } from "lucide-react";

const TransferScreen1 = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-card-foreground mb-8">Payment Screen</h1>

          {/* Balance Display */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Current Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">$12,234.56</div>
              <p className="text-muted-foreground">Available for transfer</p>
            </CardContent>
          </Card>

          {/* Transfer Options */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Manual Transfer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Specify amount and recipient manually
                </p>
                <Link to="/transfer/manual">
                  <Button className="w-full">Start Manual Transfer</Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Load Invoice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="invoice-upload">Upload Invoice from PC or drag here</Label>
                  <div className="mt-2">
                    <Input
                      id="invoice-upload"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={handleFileUpload}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                    />
                  </div>
                  {uploadedFile && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      {uploadedFile.name}
                    </div>
                  )}
                </div>
                
                <Link to="/transfer/invoice">
                  <Button 
                    className="w-full" 
                    disabled={!uploadedFile}
                    variant={uploadedFile ? "default" : "outline"}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Pay This Invoice
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

export default TransferScreen1;
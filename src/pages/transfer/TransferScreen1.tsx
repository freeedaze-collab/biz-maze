// @ts-nocheck
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TransferScreen1 = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleInvoicePayment = async () => {
    if (!uploadedFile) return;
    
    setIsProcessing(true);
    try {
      // Parse PDF invoice (mock implementation)
      const invoiceData = {
        recipient: "ACME Corporation",
        amount: "1,250.00",
        invoiceNumber: "INV-2024-001",
        description: "Web Development Services",
        address: "0x742d35Cc6A6C6A6C6A6C3A6C6A6C6A6C6A6C6A6C" // Mock wallet address
      };
      
      // Store parsed data for confirmation screen
      sessionStorage.setItem('invoiceData', JSON.stringify(invoiceData));
      
      toast({
        title: "Invoice Processed",
        description: "Invoice data extracted successfully",
      });
      
      navigate('/transfer/invoice-confirm');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process invoice file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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
                
                <Button 
                  onClick={handleInvoicePayment}
                  className="w-full" 
                  disabled={!uploadedFile || isProcessing}
                  variant={uploadedFile ? "default" : "outline"}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isProcessing ? "Processing..." : "Pay This Invoice"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferScreen1;
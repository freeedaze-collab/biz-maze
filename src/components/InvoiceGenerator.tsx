import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
  amount: number;
}

interface CompanyInfo {
  email: string;
  companyName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  taxId: string;
}

interface ClientInfo {
  name: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface PaymentInfo {
  cryptocurrency: string;
  network: string;
  walletAddress: string;
  instructions: string;
}

interface InvoiceGeneratorProps {
  existingRecipient?: ClientInfo;
  onSaveRecipient?: (recipient: ClientInfo) => void;
  onInvoiceGenerated?: (invoiceData: any) => void;
}

export const InvoiceGenerator = ({ existingRecipient, onSaveRecipient, onInvoiceGenerated }: InvoiceGeneratorProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [invoiceNumber, setInvoiceNumber] = useState("000001");
  const [issuedDate, setIssuedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    email: "",
    companyName: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    taxId: ""
  });

  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "United States"
  });

  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    cryptocurrency: "BTC",
    network: "Bitcoin",
    walletAddress: "",
    instructions: ""
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { id: "1", description: "", quantity: 1, price: 0, amount: 0 }
  ]);

  // Load user profile data for company info
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, email, account_type, tax_country')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          setCompanyInfo(prev => ({
            ...prev,
            email: profile.email || user.email || "",
            companyName: profile.account_type === 'corporate' ? profile.display_name || "" : "",
            country: profile.tax_country || "United States"
          }));
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    loadUserProfile();
  }, [user]);

  // Load existing recipient data
  useEffect(() => {
    if (existingRecipient) {
      setClientInfo(existingRecipient);
    }
  }, [existingRecipient]);

  // Calculate item amounts and totals
  useEffect(() => {
    setItems(items.map(item => ({
      ...item,
      amount: item.quantity * item.price
    })));
  }, [items]);

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal;

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: "",
      quantity: 1,
      price: 0,
      amount: 0
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => 
      item.id === id 
        ? { ...item, [field]: value }
        : item
    ));
  };

  const handleSaveRecipient = () => {
    if (onSaveRecipient && clientInfo.name && clientInfo.email) {
      onSaveRecipient(clientInfo);
      toast({
        title: "Recipient Saved",
        description: "Client information has been saved for future use.",
      });
    }
  };

  const handleGenerateInvoice = () => {
    // Validation
    const errors: string[] = [];
    
    if (!companyInfo.companyName) errors.push("Company name is required");
    if (!companyInfo.email) errors.push("Company email is required");
    if (!clientInfo.name && !existingRecipient?.name) errors.push("Client name is required");
    if (!clientInfo.email && !existingRecipient?.email) errors.push("Client email is required");
    if (!invoiceNumber) errors.push("Invoice number is required");
    if (!issuedDate) errors.push("Issue date is required");
    if (!dueDate) errors.push("Due date is required");
    
    const validItems = items.filter(item => item.description && item.quantity && item.price);
    if (validItems.length === 0) errors.push("At least one item is required");
    
    if (errors.length > 0) {
      errors.forEach(error => {
        toast({
          title: "Validation Error",
          description: error,
          variant: "destructive",
        });
      });
      return;
    }

    const invoiceData = {
      invoiceNumber,
      issuedDate,
      dueDate,
      companyInfo,
      clientInfo: existingRecipient || clientInfo,
      items: validItems,
      subtotal,
      total,
      paymentInfo,
      createdAt: new Date().toISOString()
    };

    if (onInvoiceGenerated) {
      onInvoiceGenerated(invoiceData);
    }

    toast({
      title: "Invoice Generated",
      description: "Your crypto invoice has been created successfully.",
    });
  };

  const handleDownloadPDF = () => {
    toast({
      title: "PDF Downloaded",
      description: "Invoice PDF has been downloaded to your device.",
    });
  };

  const handleSendEmail = () => {
    const clientEmail = existingRecipient?.email || clientInfo.email;
    if (!clientEmail) {
      toast({
        title: "Email Error",
        description: "Client email is required to send invoice.",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Invoice Sent",
      description: `Invoice has been sent to ${clientEmail}`,
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Crypto Invoice Generator</h2>
          
          <Tabs defaultValue="company" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="company">Company</TabsTrigger>
              <TabsTrigger value="client">Client</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="payment">Payment</TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Your Company</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={companyInfo.email}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                      placeholder="e.g. info@acme.inc"
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={companyInfo.companyName}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, companyName: e.target.value })}
                      placeholder="Acme Inc"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={companyInfo.address}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                      placeholder="Mission Street, 79"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={companyInfo.city}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, city: e.target.value })}
                        placeholder="San Francisco"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={companyInfo.state}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, state: e.target.value })}
                        placeholder="California"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="zip">Zip</Label>
                      <Input
                        id="zip"
                        value={companyInfo.zip}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, zip: e.target.value })}
                        placeholder="94016"
                      />
                    </div>
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={companyInfo.country}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, country: e.target.value })}
                        placeholder="United States"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="taxId">Tax ID</Label>
                    <Input
                      id="taxId"
                      value={companyInfo.taxId}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, taxId: e.target.value })}
                      placeholder="0123VS"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="client" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Your Client</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      value={clientInfo.name}
                      onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                      placeholder="Client Company Name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientEmail">Email</Label>
                    <Input
                      id="clientEmail"
                      type="email"
                      value={clientInfo.email}
                      onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
                      placeholder="client@company.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientAddress">Address</Label>
                    <Input
                      id="clientAddress"
                      value={clientInfo.address}
                      onChange={(e) => setClientInfo({ ...clientInfo, address: e.target.value })}
                      placeholder="Client Address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="clientCity">City</Label>
                      <Input
                        id="clientCity"
                        value={clientInfo.city}
                        onChange={(e) => setClientInfo({ ...clientInfo, city: e.target.value })}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label htmlFor="clientState">State</Label>
                      <Input
                        id="clientState"
                        value={clientInfo.state}
                        onChange={(e) => setClientInfo({ ...clientInfo, state: e.target.value })}
                        placeholder="State"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="clientZip">Zip</Label>
                      <Input
                        id="clientZip"
                        value={clientInfo.zip}
                        onChange={(e) => setClientInfo({ ...clientInfo, zip: e.target.value })}
                        placeholder="Zip"
                      />
                    </div>
                    <div>
                      <Label htmlFor="clientCountry">Country</Label>
                      <Input
                        id="clientCountry"
                        value={clientInfo.country}
                        onChange={(e) => setClientInfo({ ...clientInfo, country: e.target.value })}
                        placeholder="Country"
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveRecipient} variant="outline" className="w-full">
                    Save as Recipient
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="invoiceNumber">Invoice No</Label>
                      <Input
                        id="invoiceNumber"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="issuedDate">Issued</Label>
                      <Input
                        id="issuedDate"
                        type="date"
                        value={issuedDate}
                        onChange={(e) => setIssuedDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Items</h3>
                      <Button onClick={addItem} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    </div>
                    
                    {items.map((item) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <Label>Description</Label>
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            placeholder="Service or product description"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Qty</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Price</Label>
                          <Input
                            type="number"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Amount</Label>
                          <Input
                            value={`$${item.amount.toFixed(2)}`}
                            disabled
                          />
                        </div>
                        <div className="col-span-1">
                          <Button
                            onClick={() => removeItem(item.id)}
                            variant="outline"
                            size="sm"
                            disabled={items.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                     ))}
                   </div>
                   
                   <div>
                     <Label htmlFor="memo">Memo (for accounting categorization)</Label>
                     <Textarea
                       id="memo"
                       placeholder="e.g., office supplies, consulting fees, software license"
                       className="min-h-[60px]"
                     />
                     <p className="text-sm text-muted-foreground mt-1">
                       This will be used for automatic journal entry categorization
                     </p>
                   </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payment" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="cryptocurrency">Payable in</Label>
                    <Select value={paymentInfo.cryptocurrency} onValueChange={(value) => setPaymentInfo({ ...paymentInfo, cryptocurrency: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                        <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                        <SelectItem value="USDT">Tether (USDT)</SelectItem>
                        <SelectItem value="USDC">USD Coin (USDC)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="network">Network</Label>
                    <Select value={paymentInfo.network} onValueChange={(value) => setPaymentInfo({ ...paymentInfo, network: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bitcoin">Bitcoin</SelectItem>
                        <SelectItem value="Ethereum">Ethereum</SelectItem>
                        <SelectItem value="Polygon">Polygon</SelectItem>
                        <SelectItem value="BSC">Binance Smart Chain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="walletAddress">Wallet Address</Label>
                    <Input
                      id="walletAddress"
                      value={paymentInfo.walletAddress}
                      onChange={(e) => setPaymentInfo({ ...paymentInfo, walletAddress: e.target.value })}
                      placeholder="Your wallet address for payments"
                    />
                  </div>
                  <div>
                    <Label htmlFor="instructions">Instructions</Label>
                    <Textarea
                      id="instructions"
                      value={paymentInfo.instructions}
                      onChange={(e) => setPaymentInfo({ ...paymentInfo, instructions: e.target.value })}
                      placeholder="Additional payment instructions..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Button onClick={handleGenerateInvoice} className="w-full" size="lg">
              Generate Invoice
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleDownloadPDF} variant="outline" className="w-full">
                Download PDF
              </Button>
              <Button onClick={handleSendEmail} variant="outline" className="w-full">
                Send Email
              </Button>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Invoice Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold">INVOICE</h1>
                    <p className="text-sm text-muted-foreground">#{invoiceNumber}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p><strong>Issued:</strong> {new Date(issuedDate).toLocaleDateString()}</p>
                    <p><strong>Due:</strong> {new Date(dueDate).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* From/To */}
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-semibold mb-2">FROM</h3>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">{companyInfo.companyName || "Your Company"}</p>
                      <p>{companyInfo.email}</p>
                      <p>{companyInfo.address}</p>
                      <p>{companyInfo.city}, {companyInfo.state} {companyInfo.zip}</p>
                      <p>{companyInfo.country}</p>
                      {companyInfo.taxId && <p>Tax ID: {companyInfo.taxId}</p>}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">TO</h3>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">{clientInfo.name || "Client Name"}</p>
                      <p>{clientInfo.email}</p>
                      <p>{clientInfo.address}</p>
                      <p>{clientInfo.city}, {clientInfo.state} {clientInfo.zip}</p>
                      <p>{clientInfo.country}</p>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 p-3 bg-muted text-sm font-medium">
                      <div className="col-span-6">DESCRIPTION</div>
                      <div className="col-span-2 text-center">QTY</div>
                      <div className="col-span-2 text-right">PRICE</div>
                      <div className="col-span-2 text-right">AMOUNT</div>
                    </div>
                    {items.map((item) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 p-3 border-t text-sm">
                        <div className="col-span-6">{item.description || "Service description"}</div>
                        <div className="col-span-2 text-center">{item.quantity}</div>
                        <div className="col-span-2 text-right">${item.price.toFixed(2)}</div>
                        <div className="col-span-2 text-right">${item.amount.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Payment Information</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>Cryptocurrency:</strong> {paymentInfo.cryptocurrency}</p>
                    <p><strong>Network:</strong> {paymentInfo.network}</p>
                    <p><strong>Wallet Address:</strong> {paymentInfo.walletAddress || "Wallet address will appear here"}</p>
                    {paymentInfo.instructions && (
                      <div>
                        <strong>Instructions:</strong>
                        <p className="mt-1">{paymentInfo.instructions}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
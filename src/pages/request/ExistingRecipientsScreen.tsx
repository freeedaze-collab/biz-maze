// @ts-nocheck
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Building2, Clock } from "lucide-react";

interface Recipient {
  id: string;
  name: string;
  email: string;
  type: 'individual' | 'business';
  lastUsed: string;
  totalInvoices: number;
}

const ExistingRecipientsScreen = () => {
  const navigate = useNavigate();
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  useEffect(() => {
    // Mock data - in real app this would come from Supabase
    const mockRecipients: Recipient[] = [
      {
        id: '1',
        name: 'ACME Corporation',
        email: 'billing@acme.com',
        type: 'business',
        lastUsed: '2024-01-10',
        totalInvoices: 5
      },
      {
        id: '2',
        name: 'John Smith',
        email: 'john@example.com',
        type: 'individual',
        lastUsed: '2024-01-05',
        totalInvoices: 2
      },
      {
        id: '3',
        name: 'Tech Solutions Ltd',
        email: 'info@techsolutions.com',
        type: 'business',
        lastUsed: '2023-12-28',
        totalInvoices: 8
      }
    ];
    setRecipients(mockRecipients);
  }, []);

  const handleSelectRecipient = (recipient: Recipient) => {
    // Store recipient data in sessionStorage for auto-filling
    sessionStorage.setItem('selectedRecipient', JSON.stringify({
      name: recipient.name,
      email: recipient.email,
      address: `${Math.floor(Math.random() * 9000) + 1000} ${recipient.name.split(' ')[0]} St`,
      city: "Sample City", 
      state: "ST",
      zip: "12345",
      country: "United States"
    }));
    navigate('/request/existing');
  };

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
          
          <div className="space-y-4">
            {recipients.map((recipient) => (
              <Card key={recipient.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleSelectRecipient(recipient)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        {recipient.type === 'business' ? (
                          <Building2 className="h-6 w-6 text-primary" />
                        ) : (
                          <User className="h-6 w-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{recipient.name}</h3>
                        <p className="text-sm text-muted-foreground">{recipient.email}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Last used: {recipient.lastUsed}
                          </div>
                          <span>•</span>
                          <span>{recipient.totalInvoices} invoices</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline">
                      Select
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {recipients.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground mb-4">No existing recipients found</p>
                <Link to="/request/new">
                  <Button>Create New Request</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExistingRecipientsScreen;
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, CheckCircle, AlertCircle, XCircle, DollarSign, Eye } from 'lucide-react';
import { useInvoiceStatus } from '@/hooks/useInvoiceStatus';
import { WalletSignatureVerification } from './WalletSignatureVerification';
import { useAuth } from '@/hooks/useAuth';

export function InvoiceStatusTracker() {
  const { user } = useAuth();
  const { 
    invoices, 
    loading, 
    updateInvoiceStatus, 
    markInvoiceAsPaid,
    getOverdueInvoices,
    getInvoicesByStatus 
  } = useInvoiceStatus();
  
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [showSignatureVerification, setShowSignatureVerification] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ action: string; invoiceId: string; newStatus: string } | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    // For high-risk actions, require wallet signature verification
    if (newStatus === 'cancelled' || newStatus === 'paid') {
      setPendingAction({ action: `mark invoice as ${newStatus}`, invoiceId, newStatus });
      setShowSignatureVerification(true);
    } else {
      await updateInvoiceStatus(invoiceId, newStatus);
    }
  };

  const handleVerifiedAction = async () => {
    if (!pendingAction) return;
    
    const success = await updateInvoiceStatus(pendingAction.invoiceId, pendingAction.newStatus);
    if (success) {
      setPendingAction(null);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const overdueInvoices = getOverdueInvoices();
  const paidInvoices = getInvoicesByStatus('paid');
  const unpaidInvoices = getInvoicesByStatus('unpaid');

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading invoices...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-2xl font-bold">{invoices.length}</p>
                </div>
                <Eye className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold text-green-600">{paidInvoices.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unpaid</p>
                  <p className="text-2xl font-bold text-yellow-600">{unpaidInvoices.length}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">{overdueInvoices.length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice List with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Status Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All ({invoices.length})</TabsTrigger>
                <TabsTrigger value="unpaid">Unpaid ({unpaidInvoices.length})</TabsTrigger>
                <TabsTrigger value="paid">Paid ({paidInvoices.length})</TabsTrigger>
                <TabsTrigger value="overdue">Overdue ({overdueInvoices.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                {invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onStatusChange={handleStatusChange}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </TabsContent>

              <TabsContent value="unpaid" className="space-y-4">
                {unpaidInvoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onStatusChange={handleStatusChange}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </TabsContent>

              <TabsContent value="paid" className="space-y-4">
                {paidInvoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onStatusChange={handleStatusChange}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </TabsContent>

              <TabsContent value="overdue" className="space-y-4">
                {overdueInvoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    onStatusChange={handleStatusChange}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Wallet Signature Verification Dialog */}
      {user && (
        <WalletSignatureVerification
          isOpen={showSignatureVerification}
          onClose={() => {
            setShowSignatureVerification(false);
            setPendingAction(null);
          }}
          onVerified={handleVerifiedAction}
          walletAddress={user.email || ''} // In real app, get from connected wallet
          action={pendingAction?.action || ''}
          description={`This action requires wallet signature verification for security purposes.`}
        />
      )}
    </>
  );
}

interface InvoiceRowProps {
  invoice: any;
  onStatusChange: (invoiceId: string, status: string) => void;
  getStatusIcon: (status: string) => JSX.Element;
  getStatusColor: (status: string) => string;
  formatCurrency: (amount: number, currency: string) => string;
}

function InvoiceRow({ 
  invoice, 
  onStatusChange, 
  getStatusIcon, 
  getStatusColor, 
  formatCurrency 
}: InvoiceRowProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          {getStatusIcon(invoice.status)}
          <div>
            <p className="font-medium">{invoice.invoice_number}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(invoice.amount, invoice.currency)}
            </p>
            {invoice.due_date && (
              <p className="text-xs text-muted-foreground">
                Due: {new Date(invoice.due_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <Badge className={getStatusColor(invoice.status)}>
          {invoice.status}
        </Badge>
        
        <Select
          value={invoice.status}
          onValueChange={(value) => onStatusChange(invoice.id, value)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
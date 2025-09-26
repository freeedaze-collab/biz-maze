import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id?: string;
  amount: number;
  currency: string;
  status: string;
  due_date?: string;
  memo?: string;
  created_at: string;
  updated_at: string;
}

export function useInvoiceStatus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchInvoices();
      
      // Set up real-time subscription for invoice status updates
      const subscription = supabase
        .channel('invoice_updates')
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'invoices',
            filter: `user_id=eq.${user.id}`
          }, 
          (payload) => {
            console.log('Invoice update received:', payload);
            handleInvoiceUpdate(payload.new as Invoice);
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchInvoices = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch invoices",
        variant: "destructive",
      });
    } else {
      setInvoices(data || []);
    }
    setLoading(false);
  };

  const handleInvoiceUpdate = (updatedInvoice: Invoice) => {
    setInvoices(prev => 
      prev.map(invoice => 
        invoice.id === updatedInvoice.id ? updatedInvoice : invoice
      )
    );

    // Show notification for status changes
    const previousInvoice = invoices.find(inv => inv.id === updatedInvoice.id);
    if (previousInvoice && previousInvoice.status !== updatedInvoice.status) {
      const statusMessages = {
        paid: "✅ Invoice has been paid!",
        overdue: "⚠️ Invoice is now overdue",
        cancelled: "❌ Invoice has been cancelled",
        draft: "📝 Invoice is in draft status"
      };

      toast({
        title: "Invoice Status Updated",
        description: statusMessages[updatedInvoice.status as keyof typeof statusMessages] || 
                    `Invoice status changed to: ${updatedInvoice.status}`,
        duration: 5000,
      });
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    const { error } = await supabase
      .from('invoices')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
      .eq('user_id', user?.id);

    if (error) {
      console.error('Error updating invoice status:', error);
      toast({
        title: "Error",
        description: "Failed to update invoice status",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Success",
      description: "Invoice status updated successfully",
    });
    
    return true;
  };

  const markInvoiceAsPaid = async (invoiceId: string, transactionHash?: string) => {
    const updateData: any = { 
      status: 'paid',
      updated_at: new Date().toISOString()
    };

    if (transactionHash) {
      // Store payment reference
      updateData.memo = `Paid via transaction: ${transactionHash}`;
    }

    const { error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .eq('user_id', user?.id);

    if (error) {
      console.error('Error marking invoice as paid:', error);
      return false;
    }

    return true;
  };

  const getOverdueInvoices = () => {
    const now = new Date();
    return invoices.filter(invoice => 
      invoice.status === 'unpaid' && 
      invoice.due_date && 
      new Date(invoice.due_date) < now
    );
  };

  const getInvoicesByStatus = (status: string) => {
    return invoices.filter(invoice => invoice.status === status);
  };

  return {
    invoices,
    loading,
    fetchInvoices,
    updateInvoiceStatus,
    markInvoiceAsPaid,
    getOverdueInvoices,
    getInvoicesByStatus,
  };
}
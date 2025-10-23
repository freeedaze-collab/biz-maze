// @ts-nocheck
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Edit3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  address: string;
  created_at: string;
}

interface CustomerManagerProps {
  onSelectCustomer?: (customer: Customer) => void;
  selectedCustomerId?: string;
}

const CustomerManager = ({ onSelectCustomer, selectedCustomerId }: CustomerManagerProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    address: ""
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading customers",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCustomer = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Name required",
        description: "Customer name is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(formData)
          .eq('id', editingCustomer.id);
        
        if (error) throw error;
        toast({ title: "Customer updated successfully" });
      } else {
        const { error } = await supabase
          .from('customers')
          .insert({
            ...formData,
            user_id: user?.id
          });
        
        if (error) throw error;
        toast({ title: "Customer added successfully" });
      }

      setFormData({ name: "", email: "", company: "", address: "" });
      setIsAddingCustomer(false);
      setEditingCustomer(null);
      fetchCustomers();
    } catch (error: any) {
      toast({
        title: "Error saving customer",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      // Soft delete first
      const { error } = await supabase
        .from('customers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', customerId);

      if (error) throw error;

      toast({ title: "Customer deleted successfully" });
      fetchCustomers();
      setDeleteCustomerId(null);
    } catch (error: any) {
      toast({
        title: "Error deleting customer",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      company: customer.company,
      address: customer.address
    });
    setIsAddingCustomer(true);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading customers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Customer Management</h3>
        <Button 
          onClick={() => setIsAddingCustomer(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {isAddingCustomer && (
        <Card>
          <CardHeader>
            <CardTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Company name"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Customer address"
                rows={3}
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={handleSaveCustomer}>
                {editingCustomer ? "Update Customer" : "Add Customer"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAddingCustomer(false);
                  setEditingCustomer(null);
                  setFormData({ name: "", email: "", company: "", address: "" });
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((customer) => (
          <Card 
            key={customer.id} 
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedCustomerId === customer.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onSelectCustomer?.(customer)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold truncate">{customer.name}</h4>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(customer);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteCustomerId(customer.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {customer.email && (
                <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
              )}
              {customer.company && (
                <p className="text-sm text-muted-foreground truncate">{customer.company}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteCustomerId} onOpenChange={() => setDeleteCustomerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this customer? This action can be undone within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCustomerId && handleDeleteCustomer(deleteCustomerId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomerManager;
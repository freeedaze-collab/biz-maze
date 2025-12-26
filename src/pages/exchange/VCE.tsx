
// src/pages/exchange/VCE.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RefreshCw, PlusCircle, Trash2 } from 'lucide-react';
import AppPageLayout from '@/components/layout/AppPageLayout';

// --- Components ---

function ExistingConnections({ onConnectionUpdate }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function fetchConnections() {
    if (!session) return;
    const { data, error } = await supabase
      .from('exchange_connections')
      .select('id, connection_name, exchange')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to load connections', description: error.message });
    } else {
      setConnections(data);
    }
  }

  useEffect(() => {
    if (session) fetchConnections();
  }, [session]);

  // Listen for updates from parent
  useEffect(() => {
    if (onConnectionUpdate) {
        fetchConnections();
    }
  }, [onConnectionUpdate]);

  const handleSync = async (connectionId: string, name: string) => {
    setLoading(prev => ({ ...prev, [connectionId]: true }));
    toast({ title: `Sync started for ${name}...` });
    try {
      const { data, error } = await supabase.functions.invoke('exchange-sync', { body: { connection_id: connectionId } });
      if (error) throw new Error(error.message);
      toast({ title: `Sync Complete for ${name}`, description: `Saved ${data.count} trades.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: `Sync Failed for ${name}`, description: e.message });
    } finally {
      setLoading(prev => ({ ...prev, [connectionId]: false }));
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!window.confirm("Are you sure you want to delete this connection? This action cannot be undone.")) return;
    const { error } = await supabase.from('exchange_connections').delete().eq('id', connectionId);
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to delete connection', description: error.message });
    } else {
      toast({ title: "Connection deleted successfully." });
      fetchConnections();
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Your Connections</CardTitle>
        <CardDescription>Sync trades or remove existing connections.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {connections.length === 0 && (
          <p className="text-sm text-muted-foreground">No exchange connections found. Add one below to get started.</p>
        )}
        {connections.map(conn => (
          <div key={conn.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
            <div className="font-medium">
              <span className="capitalize bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs mr-2">{conn.exchange}</span>
              <span>{conn.connection_name}</span>
            </div>
            <div className='space-x-2'>
              <Button size="sm" onClick={() => handleSync(conn.id, conn.connection_name)} disabled={loading[conn.id]}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading[conn.id] ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(conn.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const EXCHANGES = [
    { name: "Binance", slug: "binance", fields: ["apiKey", "apiSecret"] },
    { name: "Coinbase", slug: "coinbase", fields: ["apiKey", "apiSecret"] },
    { name: "Kraken", slug: "kraken", fields: ["apiKey", "apiSecret"] },
    { name: "OKX", slug: "okx", fields: ["apiKey", "apiSecret", "passphrase"] },
    { name: "Bybit", slug: "bybit", fields: ["apiKey", "apiSecret"] },
    { name: "Bitget", slug: "bitget", fields: ["apiKey", "apiSecret", "passphrase"] },
    { name: "Gate.io", slug: "gate", fields: ["apiKey", "apiSecret"] },
    { name: "KuCoin", slug: "kucoin", fields: ["apiKey", "apiSecret", "passphrase"] },
    { name: "BingX", slug: "bingx", fields: ["apiKey", "apiSecret"] },
    { name: "Crypto.com", slug: "crypto_com", fields: ["apiKey", "apiSecret"] },
    { name: "bitFlyer", slug: "bitflyer", fields: ["apiKey", "apiSecret"] },
    { name: "Coincheck", slug: "coincheck", fields: ["apiKey", "apiSecret"] },
];

function ExchangeConnectionForm({ exchange, onSave }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
      connection_name: '',
      api_key: '',
      api_secret: '',
      api_passphrase: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const body = {
      exchange: exchange.slug,
      connection_name: formData.connection_name,
      api_key: formData.api_key,
      api_secret: formData.api_secret,
    };

    if (exchange.fields.includes("passphrase")) {
      body.api_passphrase = formData.api_passphrase;
    }

    try {
      const { error } = await supabase.functions.invoke("exchange-save-keys", { body });
      if (error) throw error;
      toast({ title: 'Connection saved successfully!' });
      onSave(); // Notify parent to refresh
      // Clear form
      setFormData({ connection_name: '', api_key: '', api_secret: '', api_passphrase: '' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to save keys', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-2">
      <Input name="connection_name" placeholder="Connection Name (e.g., 'My Main Account')" value={formData.connection_name} onChange={handleInputChange} required />
      
      {exchange.fields.map(field => {
        const isSecret = field.toLowerCase().includes('secret') || field.toLowerCase().includes('passphrase');
        const placeholder = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        return (
            <Input 
              key={field}
              name={field.replace('api','api_').toLowerCase()} // e.g. apiKey -> api_key
              placeholder={placeholder}
              type={isSecret ? "password" : "text"}
              value={formData[field.replace('api','api_').toLowerCase()]}
              onChange={handleInputChange}
              required 
              autoComplete="new-password" 
            />
        );
      })}
      
      <Button type="submit" disabled={loading} className="w-full">
        <PlusCircle className="mr-2 h-4 w-4" />
        {loading ? 'Saving...' : `Save ${exchange.name} Keys`}
      </Button>
    </form>
  )
}

function AddNewConnectionManager({ onConnectionSave }) {
    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Add New Connection</CardTitle>
                <CardDescription>Select an exchange and provide read-only API keys.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    {EXCHANGES.map(exchange => (
                        <AccordionItem key={exchange.slug} value={exchange.slug}>
                            <AccordionTrigger>{exchange.name}</AccordionTrigger>
                            <AccordionContent>
                                <ExchangeConnectionForm exchange={exchange} onSave={onConnectionSave} />
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
                <div className='mt-6 space-y-2'>
                    <p className="text-xs text-muted-foreground p-2">
                        Security: API keys are encrypted and stored safely. Please ensure permissions are read-only and do not enable trading or withdrawals.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

export function VCEPage() {
  const [connectionUpdate, setConnectionUpdate] = useState(0);

  const handleConnectionSave = () => {
    setConnectionUpdate(c => c + 1);
  };

  return (
    <AppPageLayout
      title="Virtual Custody Exchange"
      description="Connect exchanges securely with read-only keys, keep balances in sync, and trigger updates when you need them."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <ExistingConnections onConnectionUpdate={connectionUpdate} />
        <AddNewConnectionManager onConnectionSave={handleConnectionSave} />
      </div>
    </AppPageLayout>
  );
}

export default VCEPage;

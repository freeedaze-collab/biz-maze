// src/pages/exchange/VCE.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Keep original supabase import path
import { useAuth } from '@/hooks/useAuth'; // This hook will be removed as per new code
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // This will be removed
import { RefreshCw, PlusCircle, Trash2, Loader2, Clock } from 'lucide-react';
import AppPageLayout from '@/components/layout/AppPageLayout';
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// --- Components ---

const EXCHANGES_CONFIG = [
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

function ExchangeConnectionForm({ exchange, onSave }: { exchange: any, onSave: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    connection_name: '',
    api_key: '',
    api_secret: '',
    api_passphrase: ''
  });

  const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  useEffect(() => {
    const fetchEntities = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('entities').select('id, name').eq('user_id', user.id).order('is_head_office', { ascending: false });
      if (data && data.length > 0) {
        setEntities(data);
        setSelectedEntityId(data[0].id); // Default to Head Office
      }
    };
    fetchEntities();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const body: any = {
      exchange: exchange.slug,
      connection_name: formData.connection_name,
      api_key: formData.api_key,
      api_secret: formData.api_secret,
      entity_id: selectedEntityId,
    };

    if (exchange.fields.includes("passphrase")) {
      body.api_passphrase = formData.api_passphrase;
    }

    try {
      const { error } = await supabase.functions.invoke("exchange-save-keys", { body });
      if (error) throw error;
      toast({ title: 'Connection saved successfully!' });
      onSave(); // Notify parent to refresh
      setFormData({ connection_name: '', api_key: '', api_secret: '', api_passphrase: '' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to save keys', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-2">
      <div className="space-y-2">
        <Label>Owner Entity</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer"
          value={selectedEntityId}
          onChange={(e) => setSelectedEntityId(e.target.value)}
        >
          {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
        </select>
      </div>

      <Input name="connection_name" placeholder="Connection Name (e.g., 'My Main Account')" value={formData.connection_name} onChange={handleInputChange} required />

      {exchange.fields.map((field: string) => {
        const isSecret = field.toLowerCase().includes('secret') || field.toLowerCase().includes('passphrase');
        const placeholder = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        return (
          <Input
            key={field}
            name={field.replace('api', 'api_').toLowerCase()}
            placeholder={placeholder}
            type={isSecret ? "password" : "text"}
            value={formData[field.replace('api', 'api_').toLowerCase()]}
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

function ExistingConnections({ onConnectionUpdate }: { onConnectionUpdate: number }) {
  const { toast } = useToast();
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);

  // Fetch Entities (Shared logic or repeating it here is fine for now)
  useEffect(() => {
    const fetchEntities = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('entities').select('id, name').eq('user_id', user.id).order('is_head_office', { ascending: false });
      if (data) setEntities(data);
    };
    fetchEntities();
  }, []);

  async function fetchConnections() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase
      .from('exchange_connections')
      .select('id, connection_name, exchange, entity_id, entities(name)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to load connections', description: error.message });
    } else {
      setConnections(data);
    }
  }

  useEffect(() => { fetchConnections(); }, [onConnectionUpdate]);

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

  const handleUpdateEntity = async (connectionId: string, newEntityId: string) => {
    const { error } = await supabase
      .from('exchange_connections')
      .update({ entity_id: newEntityId })
      .eq('id', connectionId);

    if (error) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
    } else {
      toast({ title: 'Entity updated', description: 'Exchange entity has been updated.' });
      fetchConnections(); // Refresh list
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
          <div key={conn.id} className="p-3 border rounded-lg bg-background">
            <div className="flex items-center justify-between">
              <div className="font-medium flex-1">
                <span className="capitalize bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs mr-2">{conn.exchange}</span>
                <span>{conn.connection_name}</span>
              </div>
              <div className='space-x-2 flex items-center'>
                <Button size="sm" onClick={() => handleSync(conn.id, conn.connection_name)} disabled={loading[conn.id]}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading[conn.id] ? 'animate-spin' : ''}`} />
                  Sync
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(conn.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 pt-2 border-t text-sm">
              <label className="text-muted-foreground text-xs whitespace-nowrap">Entity:</label>
              <select
                className="flex-1 h-7 text-xs rounded-md border bg-transparent px-2 cursor-pointer"
                value={conn.entity_id || ''}
                onChange={(e) => handleUpdateEntity(conn.id, e.target.value)}
              >
                <option value="">Not assigned</option>
                {entities.map(ent => (
                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AddNewConnectionManager({ onConnectionSave }: { onConnectionSave: () => void }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Add New Connection</CardTitle>
        <CardDescription>Select an exchange and provide read-only API keys.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {EXCHANGES_CONFIG.map(exchange => {
            const isComingSoon = exchange.slug !== 'binance';
            return (
              <AccordionItem
                key={exchange.slug}
                value={exchange.slug}
                className={isComingSoon ? "opacity-50" : ""}
              >
                <div className="flex items-center justify-between pr-4">
                  <AccordionTrigger
                    className={`flex-1 ${isComingSoon ? "pointer-events-none cursor-not-allowed" : ""}`}
                    disabled={isComingSoon}
                  >
                    <div className="flex items-center gap-2">
                      {exchange.name}
                      {isComingSoon && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                </div>
                <AccordionContent>
                  {!isComingSoon && <ExchangeConnectionForm exchange={exchange} onSave={onConnectionSave} />}
                </AccordionContent>
              </AccordionItem>
            );
          })}
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

// test-commit-123

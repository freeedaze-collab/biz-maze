import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, PlusCircle, Trash2, AlertCircle } from 'lucide-react';

function ExistingConnections() {
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
      setConnections(data || []);
    }
  }

  useEffect(() => {
    if (session) fetchConnections();
  }, [session]);

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
    if (!window.confirm('Are you sure you want to delete this connection? This action cannot be undone.')) return;
    const { error } = await supabase.from('exchange_connections').delete().eq('id', connectionId);
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to delete connection', description: error.message });
    } else {
      toast({ title: 'Connection deleted successfully.' });
      fetchConnections();
    }
  };

  if (connections.length === 0) {
    return (
      <div className="card-elevated p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Your Connections</h2>
        <p className="text-muted-foreground text-sm">No exchange connections found. Add one below to get started.</p>
      </div>
    );
  }

  return (
    <div className="card-elevated p-6">
      <h2 className="text-lg font-semibold text-foreground mb-2">Your Connections</h2>
      <p className="text-muted-foreground text-sm mb-4">Sync trades or remove existing connections.</p>
      <div className="space-y-3">
        {connections.map(conn => (
          <div key={conn.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-background">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded text-xs font-medium bg-muted text-muted-foreground capitalize">{conn.exchange}</span>
              <span className="font-medium text-foreground">{conn.connection_name}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleSync(conn.id, conn.connection_name)} disabled={loading[conn.id]}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading[conn.id] ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(conn.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddNewConnectionForm() {
  const { toast } = useToast();
  const [exchange, setExchange] = useState('binance');
  const [connectionName, setConnectionName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('exchange-save-keys', {
        body: {
          exchange: exchange,
          connection_name: connectionName,
          api_key: apiKey,
          api_secret: apiSecret,
          api_passphrase: exchange === 'okx' ? passphrase : undefined,
        },
      });
      if (error) throw error;
      toast({ title: 'Connection saved successfully!' });
      window.location.reload();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to save keys', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-elevated p-6">
      <h2 className="text-lg font-semibold text-foreground mb-2">Add New Connection</h2>
      <p className="text-muted-foreground text-sm mb-6">Enter a unique name and provide read-only API keys from your exchange.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Connection Name</label>
          <Input
            placeholder="e.g., My Main Binance"
            value={connectionName}
            onChange={e => setConnectionName(e.target.value)}
            required
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Exchange</label>
          <select
            value={exchange}
            onChange={e => setExchange(e.target.value)}
            className="select-field"
          >
            <option value="binance">Binance</option>
            <option value="bybit">Bybit</option>
            <option value="okx">OKX</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">API Key</label>
          <Input
            placeholder="Enter API Key"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            required
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">API Secret</label>
          <Input
            type="password"
            placeholder="Enter API Secret"
            value={apiSecret}
            onChange={e => setApiSecret(e.target.value)}
            required
            className="input-field"
          />
        </div>

        {exchange === 'okx' && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">API Passphrase (OKX only)</label>
            <Input
              type="password"
              placeholder="Enter Passphrase"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              required
              className="input-field"
            />
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          <PlusCircle className="w-4 h-4 mr-2" />
          {loading ? 'Saving...' : 'Save & Link API Keys'}
        </Button>
      </form>

      <div className="mt-6 p-4 rounded-lg bg-muted/50 flex gap-3">
        <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Security Notice</p>
          <p>API keys are encrypted and stored securely. Never grant trading or withdrawal permissions. Use read-only access only.</p>
        </div>
      </div>
    </div>
  );
}

export function VCEPage() {
  return (
    <AppLayout>
      <div className="content-container">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Exchange Connections</h1>
          <p className="text-muted-foreground mt-1">Connect your exchange accounts to automatically sync trades and holdings.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <ExistingConnections />
          <AddNewConnectionForm />
        </div>
      </div>
    </AppLayout>
  );
}

export default VCEPage;

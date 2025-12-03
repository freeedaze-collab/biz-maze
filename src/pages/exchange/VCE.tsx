// src/pages/exchange/VCE.tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, PlusCircle, Trash2 } from 'lucide-react';

// --- [修正] ここからが完全なコンポーネント定義です ---

// 保存済みの接続を表示・管理するコンポーネント
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
      .order('created_at', { ascending: false }); // 新しいものを上に

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to load connections', description: error.message });
    } else {
      setConnections(data);
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
    if (!window.confirm("Are you sure you want to delete this connection? This action cannot be undone.")) return;
    const { error } = await supabase.from('exchange_connections').delete().eq('id', connectionId);
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to delete connection', description: error.message });
    } else {
      toast({ title: "Connection deleted successfully." });
      fetchConnections(); // リストを再読み込み
    }
  };

  if (connections.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Your Connections</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">No exchange connections found. Add one below to get started.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Connections</CardTitle>
        <CardDescription>Sync trades or remove existing connections.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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

// 新しい接続を追加するフォームコンポーネント
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
      const { error } = await supabase.functions.invoke("exchange-save-keys", {
        body: {
          exchange: exchange,
          connection_name: connectionName,
          api_key: apiKey,
          api_secret: apiSecret,
          api_passphrase: exchange === "okx" ? passphrase : undefined,
        },
      });
      if (error) throw error;
      toast({ title: 'Connection saved successfully!' });
      window.location.reload(); // 保存成功後、ページをリロードしてリストを更新
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to save keys', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Connection</CardTitle>
        <CardDescription>Give your connection a unique name and provide read-only API keys.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Connection Name (e.g., 'My Main Binance')" value={connectionName} onChange={e => setConnectionName(e.target.value)} required />
          
          <select value={exchange} onChange={e => setExchange(e.target.value)} className="w-full p-2 border rounded-md bg-transparent">
            <option value="binance">Binance</option>
            <option value="bybit">Bybit</option>
            <option value="okx">OKX</option>
          </select>

          <Input placeholder="API Key" value={apiKey} onChange={e => setApiKey(e.target.value)} required />
          <Input placeholder="API Secret" type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} required />
          
          {exchange === "okx" && (
            <Input placeholder="API Passphrase (for OKX only)" type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} required />
          )}
          
          <Button type="submit" disabled={loading} className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            {loading ? 'Saving...' : 'Save & Link API Keys'}
          </Button>
        </form>
         <div className='mt-6 space-y-2'>
            <p className="text-xs text-muted-foreground">
              セキュリティ: API Key/Secret は Edge Functions 側で暗号化されて安全に保存されます。
              取引/出金権限は絶対に付与せず、読み取り(Read-only)権限のみにしてください。
            </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ページ全体をレンダリングするメインコンポーネント
export function VCEPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Exchange Connections</h1>
        <p className="text-muted-foreground">
          Connect your exchange accounts to automatically sync your trades and holdings.
        </p>
      </div>
      <ExistingConnections />
      <AddNewConnectionForm />
    </div>
  );
}

// --- [修正] ここまでが完全なコンポーネント定義です ---

export default VCEPage;

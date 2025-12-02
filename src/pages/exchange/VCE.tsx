// src/pages/exchange/VCE.tsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { RefreshCw, PlusCircle, Trash2 } from 'lucide-react'

// 既存の接続を表示し、同期・削除を行うコンポーネント
function ExistingConnections() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function fetchConnections() {
    if (!session) return;
    const { data, error } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('user_id', session.user.id);
    if (error) toast({ variant: 'destructive', title: 'Failed to load connections', description: error.message });
    else setConnections(data);
  }

  useEffect(() => { fetchConnections() }, [session]);

  const handleSync = async (exchange: string) => {
    const id = `sync-${exchange}`;
    setLoading(prev => ({ ...prev, [id]: true }));
    toast({ title: `Sync started for ${exchange}...` });
    try {
      const { data, error } = await supabase.functions.invoke('exchange-sync', { body: { exchange } });
      if (error) throw new Error(error.message);
      toast({ title: `Sync Complete for ${exchange}`, description: data.message });
    } catch (e: any) {
      toast({ variant: 'destructive', title: `Sync Failed for ${exchange}`, description: e.message });
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this connection?")) return;
    const { error } = await supabase.from('exchange_connections').delete().eq('id', id);
    if (error) toast({ variant: 'destructive', title: 'Failed to delete', description: error.message });
    else {
        toast({ title: 'Connection deleted' });
        fetchConnections();
    }
  };

  if (connections.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle>Your Connections</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {connections.map(conn => (
          <div key={conn.id} className="flex items-center justify-between p-3 border rounded-lg">
            <span className="font-semibold capitalize">{conn.exchange}</span>
            <div className='space-x-2'>
              <Button size="sm" onClick={() => handleSync(conn.exchange)} disabled={loading[`sync-${conn.exchange}`]}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading[`sync-${conn.exchange}`] ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(conn.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// APIキーを保存するためのフォームコンポーネント
function AddNewConnectionForm() {
  const { toast } = useToast();
  const [exchange, setExchange] = useState('binance');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState(''); // OKX用
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // [最重要修正] 正しい関数 `exchange-save-keys` を呼び出す
      const { error } = await supabase.functions.invoke("exchange-save-keys", {
        body: {
          exchange: exchange,
          // [最重要修正] 正しいパラメータ名 (snake_case) を使用
          api_key: apiKey,
          api_secret: apiSecret,
          api_passphrase: exchange === "okx" ? passphrase : undefined,
        },
      });
      
      if (error) throw error;

      toast({ title: 'API Keys saved successfully!' });
      // 成功したらフォームをリセットし、リストをリロード
      setApiKey(''); setApiSecret(''); setPassphrase('');
      window.location.reload();

    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to save keys', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Exchange</CardTitle>
        <CardDescription>Your API keys will be encrypted and stored securely.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select value={exchange} onChange={e => setExchange(e.target.value)} className="w-full p-2 border rounded">
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
            {loading ? 'Saving...' : 'Save Connection'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ページ全体のコンポーネント
export function VCEPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Exchange Connections</h1>
      <ExistingConnections />
      <AddNewConnectionForm />
    </div>
  );
}

export default VCEPage;

// src/pages/exchange/VCE.tsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { RefreshCw, PlusCircle, Trash2 } from 'lucide-react'

// 既存の接続を表示・同期・削除するコンポーネント
function ExistingConnections() {
  // (このコンポーネントのロジックは前回提案から変更ありませんが、
  // handleSyncがconnection_idを渡すように修正します)
  // ...
};


// APIキーを保存するためのフォームコンポーネント
function AddNewConnectionForm() {
  const { toast } = useToast();
  const [exchange, setExchange] = useState('binance');
  const [connectionName, setConnectionName] = useState(''); // [修正] 接続名のstateを追加
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
          connection_name: connectionName, // [修正] 接続名を渡す
          api_key: apiKey,
          api_secret: apiSecret,
          api_passphrase: exchange === "okx" ? passphrase : undefined,
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
    <Card>
      <CardHeader>
        <CardTitle>Add New Exchange</CardTitle>
        <CardDescription>Give your connection a unique name and provide read-only API keys.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* [修正] 接続名入力欄を追加 */}
          <Input placeholder="Connection Name (e.g., 'My Main Binance')" value={connectionName} onChange={e => setConnectionName(e.target.value)} required />
          
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
      {/* <ExistingConnections /> */} {/* このコンポーネントは次のステップで完成させます */}
      <AddNewConnectionForm />
    </div>
  );
}

export default VCEPage;

// src/pages/exchange/VCE.tsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { RefreshCw, PlusCircle, Trash2 } from 'lucide-react'

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
      .eq('user_id', session.user.id);
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
      // [重要] connection_id を渡して同期を実行
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

  if (connections.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Connections</CardTitle>
        <CardDescription>Sync trades or remove existing connections.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connections.map(conn => (
          <div key={conn.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
            <div className="font-semibold">
              <span className="capitalize">{conn.exchange}</span>: <span>{conn.connection_name}</span>
            </div>
            <div className='space-x-2'>
              <Button size="sm" onClick={() => handleSync(conn.id, conn.connection_name)} disabled={loading[conn.id]}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading[conn.id] ? 'animate-spin' : ''}`} />
                Sync
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(conn.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}


// (AddNewConnectionForm と VCEPage は変更なし)
function AddNewConnectionForm() { /* ... */ }
export function VCEPage() { /* ... */ }

export default VCEPage;

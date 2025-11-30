// src/pages/exchange/VCE.tsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from "@/components/ui/use-toast"

type Exchange = 'binance' | 'bybit' | 'okx'
type ConnectionStatus = 'not_linked' | 'linked_keys' | 'failed'

interface ExchangeConnection {
  exchange: Exchange
  status: ConnectionStatus
}

export function VCE() {
  const { session } = useAuth()
  const { toast } = useToast()

  const [connections, setConnections] = useState<ExchangeConnection[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedExchange, setSelectedExchange] = useState<Exchange>('binance')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [apiPassphrase, setApiPassphrase] = useState('')
  const [externalUserId, setExternalUserId] = useState('')

  async function fetchConnections() {
    if (!session) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('exchange_connections')
      .select('exchange, status')
      .eq('user_id', session.user.id)
      
    if (error) {
      toast({ variant: "destructive", title: "Error fetching connections", description: error.message })
    } else {
        const initialConnections: ExchangeConnection[] = [];
        const exchanges: Exchange[] = ['binance', 'bybit', 'okx'];
        exchanges.forEach(ex => {
            const existing = data.find(d => d.exchange === ex);
            initialConnections.push(existing || { exchange: ex, status: 'not_linked' });
        });
        setConnections(initialConnections);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchConnections()
  }, [session])

  const handleSaveKeys = async () => {
    if (!session || !apiKey || !apiSecret) {
      toast({ variant: "destructive", title: "Missing Fields", description: "API Key and Secret are required." })
      return
    }
    setLoading(true)
    const { error } = await supabase.functions.invoke('exchange-save-keys', {
      body: {
        exchange: selectedExchange, api_key: apiKey, api_secret: apiSecret,
        api_passphrase: apiPassphrase, external_user_id: externalUserId,
      },
    })
    setLoading(false)

    if (error) {
      toast({ variant: "destructive", title: "Failed to save keys", description: error.message })
    } else {
      toast({ title: "API Keys saved successfully!" })
      setApiKey(''); setApiSecret(''); setApiPassphrase(''); setExternalUserId('');
      fetchConnections();
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Virtual Custody / Exchanges (VCE)</h1>
        <p className="text-muted-foreground">Connect your exchange accounts to automatically sync your trading history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Link New Exchange Account</CardTitle>
          <CardDescription>Enter your read-only API keys here. They will be stored encrypted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select onValueChange={(v: Exchange) => setSelectedExchange(v)} defaultValue={selectedExchange}>
            <SelectTrigger><SelectValue placeholder="Select Exchange" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="binance">Binance</SelectItem>
              <SelectItem value="bybit">Bybit</SelectItem>
              <SelectItem value="okx">OKX</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="API Key" value={apiKey} onChange={e => setApiKey(e.target.value)} />
          <Input type="password" placeholder="API Secret" value={apiSecret} onChange={e => setApiSecret(e.target.value)} />
          {selectedExchange === 'okx' && 
            <Input type="password" placeholder="API Passphrase (for OKX)" value={apiPassphrase} onChange={e => setApiPassphrase(e.target.value)} />}
          <Input placeholder="External User ID (Optional)" value={externalUserId} onChange={e => setExternalUserId(e.target.value)} />
          <Button onClick={handleSaveKeys} disabled={loading}>
            {loading ? 'Saving...' : 'Save API Keys'}
          </Button>
        </CardContent>
      </Card>
      
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Connected Accounts</h2>
        <div className="space-y-4">
            {connections.map(c => (
                <Card key={c.exchange}>
                    <CardHeader>
                        <CardTitle className="capitalize">{c.exchange}</CardTitle>
                        <CardDescription>Status: <span className="font-semibold">{c.status.replace('_', ' ')}</span></CardDescription>
                    </CardHeader>
                </Card>
            ))}
        </div>
      </div>
    </div>
  )
}

export default VCE

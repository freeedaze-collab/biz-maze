// src/pages/Transactions.tsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { RefreshCw } from 'lucide-react'

// データ取得と同期を行うコンポーネント
function SyncHub() {
  const { session } = useAuth()
  const { toast } = useToast()
  const [wallets, setWallets] = useState<{ wallet_address: string, wallet_name: string | null, chain: string }[]>([])
  const [exchanges, setExchanges] = useState<{ exchange: string }[]>([])
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  async function fetchConnections() {
    if (!session) return
    setLoading(prev => ({ ...prev, fetch: true }))

    const { data: walletData, error: walletError } = await supabase
        .from('wallet_connections')
        .select('wallet_address, wallet_name, chain')
        .eq('user_id', session.user.id)
    
    if (walletError) {
        toast({ variant: 'destructive', title: 'Error fetching wallets', description: walletError.message })
    } else {
        setWallets(walletData || [])
    }

    const { data: exchangeData, error: exchangeError } = await supabase
        .from('exchange_connections')
        .select('exchange')
        .eq('user_id', session.user.id)

    if (exchangeError) {
        toast({ variant: 'destructive', title: 'Error fetching exchanges', description: exchangeError.message })
    } else {
        setExchanges(exchangeData || [])
    }
    setLoading(prev => ({ ...prev, fetch: false }))
  }

  useEffect(() => {
    fetchConnections()
  }, [session])

  const handleSync = async (type: 'wallet' | 'exchange', identifier: string, chain?: string) => {
    if (!session) return
    const id = `${type}-${identifier}-${chain || ''}`
    setLoading(prev => ({ ...prev, [id]: true }))
    
    try {
      const functionName = type === 'wallet' ? 'sync-wallet-transactions' : 'exchange-sync'
      const body = type === 'wallet' 
        ? { walletAddress: identifier, chain: chain } 
        : { exchange: identifier }

      if (type === 'wallet' && !chain) throw new Error("Chain is required for wallet sync.")

      toast({ title: `Sync started for ${identifier} on ${chain || 'exchange'}...` })

      const { data, error } = await supabase.functions.invoke(functionName, { body })

      if (error) throw new Error(error.message)
      
      const message = data.details || `Sync successful! ${data.count || 0} items saved.`
      toast({ title: `Sync Complete for ${identifier}`, description: message })
      window.location.reload();

    } catch (e: any) {
      toast({ variant: 'destructive', title: `Sync Failed for ${identifier}`, description: e.message })
      console.error(`Sync error for ${id}:`, e)
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  if (loading.fetch) return <p>Loading connections...</p>

  if (wallets.length === 0 && exchanges.length === 0) {
      return (
          <Alert>
            <AlertTitle>No Connections Found</AlertTitle>
            <AlertDescription>Please connect a wallet or an exchange account first.</AlertDescription>
          </Alert>
      )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Sync</CardTitle>
        <CardDescription>Click to sync the latest transaction history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {wallets.map(w => (
          <div key={w.wallet_address + w.chain} className="flex items-center justify-between p-2 border rounded-md">
            <span>Wallet: {w.wallet_name || w.wallet_address} ({w.chain})</span>
            <Button size="sm" onClick={() => handleSync('wallet', w.wallet_address, w.chain)} disabled={loading[`wallet-${w.wallet_address}-${w.chain}`]}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading[`wallet-${w.wallet_address}-${w.chain}`] ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        ))}
        {exchanges.map(ex => (
          <div key={ex.exchange} className="flex items-center justify-between p-2 border rounded-md">
            <span className="capitalize">Exchange: {ex.exchange}</span>
            <Button size="sm" onClick={() => handleSync('exchange', ex.exchange)} disabled={loading[`exchange-${ex.exchange}`]}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading[`exchange-${ex.exchange}`] ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TransactionsTable() {
    return (
        <Card>
            <CardHeader><CardTitle>All Transactions</CardTitle></CardHeader>
            <CardContent><p>Transaction list will be displayed here.</p></CardContent>
        </Card>
    )
}

export function TransactionsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
      <SyncHub />
      <TransactionsTable />
    </div>
  )
}

export default TransactionsPage

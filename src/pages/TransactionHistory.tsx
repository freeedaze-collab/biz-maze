// src/pages/Transactions.tsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RefreshCw } from 'lucide-react'

// データ取得と同期を行うコンポーネント
function SyncHub() {
  const { session } = useAuth()
  const { toast } = useToast()
  const [wallets, setWallets] = useState<{ address: string, name: string }[]>([])
  const [exchanges, setExchanges] = useState<{ exchange: string }[]>([])
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  async function fetchConnections() {
    if (!session) return
    // ウォレット接続を取得 (仮のデータ。本来は 'wallet_connections' テーブルなどから取得)
    setWallets([
        { address: '0x1234...5678', name: 'My MetaMask' } 
    ])
    // 取引所接続を取得
    const { data, error } = await supabase.from('exchange_connections').select('exchange').eq('user_id', session.user.id);
    if (error) toast({ variant: 'destructive', title: 'Error fetching connections', description: error.message })
    else setExchanges(data || [])
  }

  useEffect(() => {
    fetchConnections()
  }, [session])

  const handleSync = async (type: 'wallet' | 'exchange', identifier: string) => {
    if (!session) return
    const id = `${type}-${identifier}`
    setLoading(prev => ({ ...prev, [id]: true }))
    
    try {
      const functionName = type === 'wallet' ? 'sync-wallet-transactions' : 'exchange-sync'
      const body = type === 'wallet' ? { walletAddress: identifier } : { exchange: identifier }

      const { data, error } = await supabase.functions.invoke(functionName, { body })

      if (error) throw new Error(error.message)
      
      const message = data.details || `Sync successful! ${data.count || 0} items saved.`
      toast({ title: `Sync Complete for ${identifier}`, description: message })

    } catch (e: any) {
      toast({ variant: 'destructive', title: `Sync Failed for ${identifier}`, description: e.message })
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  if (wallets.length === 0 && exchanges.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Sync</CardTitle>
        <CardDescription>Click to sync the latest transaction history from your connected wallets and exchanges.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {wallets.map(w => (
          <div key={w.address} className="flex items-center justify-between p-2 border rounded-md">
            <span>Wallet: {w.name} ({w.address})</span>
            <Button size="sm" onClick={() => handleSync('wallet', w.address)} disabled={loading[`wallet-${w.address}`]}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading[`wallet-${w.address}`] ? 'animate-spin' : ''}`} />
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

// 取引履歴テーブルのプレースホルダー
function TransactionsTable() {
    // ここに既存の取引履歴テーブルのロジックが入ります
    // (例: v_all_transactions からデータをフェッチして表示)
    return (
        <Card>
            <CardHeader><CardTitle>All Transactions</CardTitle></CardHeader>
            <CardContent>
                <p>Transaction list will be displayed here.</p>
            </CardContent>
        </Card>
    )
}

export function TransactionsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
      
      {/* 同期ハブ */}
      <SyncHub />

      {/* 既存の取引一覧 */}
      <TransactionsTable />

    </div>
  )
}

export default TransactionsPage

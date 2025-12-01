// src/pages/Transactions.tsx
import { useState, useEffect } from 'react'
// ... (他のimportは変更なし)
import { RefreshCw } from 'lucide-react'

function SyncHub() {
  const { session } = useAuth()
  const { toast } = useToast()
  // ウォレットの型に `chain` を追加
  const [wallets, setWallets] = useState<{ wallet_address: string, wallet_name: string | null, chain: string }[]>([])
  const [exchanges, setExchanges] = useState<{ exchange: string }[]>([])
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  async function fetchConnections() {
    if (!session) return
    setLoading(prev => ({ ...prev, fetch: true }))

    // `chain` カラムも一緒に取得する
    const { data: walletData, error: walletError } = await supabase
        .from('wallet_connections')
        .select('wallet_address, wallet_name, chain') // chain を追加
        .eq('user_id', session.user.id)
    
    // ... (エラーハンドリングは変更なし)
    if (!walletError) {
        setWallets(walletData || [])
    }

    // ... (取引所の取得部分は変更なし)
    setLoading(prev => ({ ...prev, fetch: false }))
  }

  useEffect(() => {
    fetchConnections()
  }, [session])

  // handleSync に `chain` パラメータを追加
  const handleSync = async (type: 'wallet' | 'exchange', identifier: string, chain?: string) => {
    if (!session) return
    const id = `${type}-${identifier}`
    setLoading(prev => ({ ...prev, [id]: true }))
    
    try {
      const functionName = type === 'wallet' ? 'sync-wallet-transactions' : 'exchange-sync'
      // bodyに `chain` を含める
      const body = type === 'wallet' 
        ? { walletAddress: identifier, chain: chain } 
        : { exchange: identifier }

      if (type === 'wallet' && !chain) throw new Error("Chain is required for wallet sync.")

      toast({ title: `Sync started for ${identifier} on ${chain || 'exchange'}...` })

      const { data, error } = await supabase.functions.invoke(functionName, { body })

      if (error) throw new Error(error.message)
      
      // ... (後続処理は変更なし)
    } catch (e: any) {
      // ... (エラーハンドリングは変更なし)
    } finally {
      setLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  // ... (ロード中や接続がない場合の表示は変更なし)

  return (
    <Card>
      {/* ... CardHeaderは変更なし ... */}
      <CardContent className="space-y-4">
        {wallets.map(w => (
          <div key={w.wallet_address} className="flex items-center justify-between p-2 border rounded-md">
            {/* チェーン名も表示する */}
            <span>Wallet: {w.wallet_name || w.wallet_address} ({w.chain})</span>
            {/* handleSyncに関数を渡す際に `w.chain` を渡す */}
            <Button size="sm" onClick={() => handleSync('wallet', w.wallet_address, w.chain)} disabled={loading[`wallet-${w.wallet_address}`]}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading[`wallet-${w.wallet_address}`] ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        ))}
        {exchanges.map(ex => (
          <div key={ex.exchange} className="flex items-center justify-between p-2 border rounded-md">
            <span className="capitalize">Exchange: {ex.exchange}</span>
            {/* 取引所の場合は chain は不要 */}
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
// ... 以降の TransactionsTable や TransactionsPage コンポーネントは変更なし

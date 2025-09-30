// src/pages/TransactionHistory.tsx
import React, { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { triggerWalletSync } from '@/lib/walletSync'
import { WalletConnectButton } from '@/components/WalletConnectButton'

type Tx = {
  id: string
  hash: string
  direction: 'in' | 'out'
  asset_symbol: string | null
  amount: string
  usd_value_at_tx: number | null
  timestamp: string
  chain: string | null
}

export default function TransactionHistory() {
  const [rows, setRows] = useState<Tx[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTx = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(200)
    if (error) setError(error.message)
    setRows((data as any[]) as Tx[])
    setLoading(false)
  }

  useEffect(() => {
    fetchTx()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    const res = await triggerWalletSync('polygon').catch((e) => ({ ok: false, message: e?.message }))
    if (!res.ok) setError(res.message ?? 'Sync failed')
    await fetchTx()
    setSyncing(false)
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <div className="flex gap-2">
          <WalletConnectButton />
          <button
            className="px-3 py-2 rounded-md border"
            onClick={handleSync}
            disabled={syncing}
            title="Resync from chain (Polygon)"
          >
            {syncing ? 'Syncing…' : 'Resync (Polygon)'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-600">{error}</div>}
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Time</th>
                <th>Hash</th>
                <th>Dir</th>
                <th>Asset</th>
                <th>Amount</th>
                <th>USD (at tx)</th>
                <th>Chain</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="py-2">{new Date(r.timestamp).toLocaleString()}</td>
                  <td className="truncate max-w-[220px]">
                    <a
                      className="underline"
                      href={`https://polygonscan.com/tx/${r.hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.hash}
                    </a>
                  </td>
                  <td>{r.direction}</td>
                  <td>{r.asset_symbol ?? '-'}</td>
                  <td>{r.amount}</td>
                  <td>{r.usd_value_at_tx ?? '-'}</td>
                  <td>{r.chain ?? 'polygon'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    No transactions. Connect wallet and click “Resync”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

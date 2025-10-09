// src/pages/wallet/WalletSelection.tsx
import { useEffect, useMemo, useState } from 'react'
import { useAccount, useBalance, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

const isEth = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v || '')

const API_BASE =
  `${(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')}/functions/v1/verify-wallet-signature`

const buildMessage = (nonce: string) => `BizMaze wallet verification\nnonce=${nonce}`

export default function WalletSelection() {
  const { user } = useAuth()
  const { address: connected, isConnected } = useAccount()
  const { connect, isPending } = useConnect({ connector: new InjectedConnector() })
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({ address: connected, query: { enabled: !!connected } })
  const { signMessageAsync } = useSignMessage()

  const [phase, setPhase] = useState<'idle' | 'input' | 'linked'>('idle')
  const [input, setInput] = useState('')
  const [nonce, setNonce] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [debug, setDebug] = useState<any>(null)

  const valid = useMemo(() => isEth(input), [input])
  const short = useMemo(() => (connected ? `${connected.slice(0, 6)}...${connected.slice(-4)}` : '-'), [connected])

  // 既存登録の一覧（簡易表示）
  const [rows, setRows] = useState<Array<{ address: string; verified: boolean }>>([])
  useEffect(() => {
    (async () => {
      if (!user) return
      const { data } = await supabase.from('wallets').select('address, verified').eq('user_id', user.id).order('created_at', { ascending: false })
      setRows(data || [])
    })()
  }, [user])

  const start = async () => {
    setMsg(null)
    setPhase('input')
    setDebug(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token || ''
      // GET nonce
      const r = await fetch(API_BASE, { headers: { Authorization: `Bearer ${token}` } })
      const j = await r.json()
      if (!r.ok || !j?.nonce) throw new Error(j?.error || 'Failed to get nonce')
      setNonce(j.nonce)
    } catch (e: any) {
      setMsg(e?.message || String(e))
    }
  }

  const verify = async () => {
    setMsg(null)
    setDebug(null)
    if (!valid) { setMsg('Invalid address'); return }
    try {
      setBusy(true)
      // 1) MetaMask 接続
      if (!isConnected) await connect()
      if (!connected) throw new Error('MetaMask not connected')

      // 2) 接続中アカウントと入力一致
      if (connected.toLowerCase() !== input.toLowerCase()) {
        throw new Error('Entered address does not match your connected MetaMask account.')
      }
      // 3) nonce が必要
      if (!nonce) throw new Error('Nonce missing. Click "Link Wallet" again.')

      // 4) 署名
      const message = buildMessage(nonce)
      const signature = await signMessageAsync({ message })

      // 5) POST 検証
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token || ''
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: input, signature, nonce }),
      })
      const json = await res.json().catch(() => ({}))
      setDebug({
        FUNCTIONS_BASE: API_BASE,
        inputAddress: input,
        nonce,
        sigLen: signature?.length ?? 0,
        postStatus: res.status,
        postBody: json,
      })
      if (!res.ok) throw new Error(json?.error || 'Verification failed')

      setMsg('Wallet linked successfully.')
      setPhase('linked')

      // 最新を反映
      if (user) {
        const { data } = await supabase.from('wallets').select('address, verified').eq('user_id', user.id).order('created_at', { ascending: false })
        setRows(data || [])
      }
    } catch (e: any) {
      setMsg(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const useConnected = () => {
    if (connected) setInput(connected)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold">Wallet Creation / Linking</h1>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="font-semibold">MetaMask</div>
          <div>{isConnected ? 'Connected' : (isPending ? 'Connecting…' : 'Disconnected')}</div>
        </div>
        <div>
          <div className="font-semibold">Account</div>
          <div className="font-mono break-all">{connected || '-'}</div>
        </div>
        <div>
          <div className="font-semibold">Short</div>
          <div>{short}</div>
        </div>
        <div>
          <div className="font-semibold">Balance</div>
          <div>{balance ? `${balance.formatted} ${balance.symbol}` : '-'}</div>
        </div>
        <div>
          <div className="font-semibold">Nonce (last)</div>
          <div className="font-mono">{nonce || '-'}</div>
        </div>
      </div>

      {phase === 'idle' && (
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={start}>
          Link Wallet
        </button>
      )}

      {phase !== 'idle' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Wallet address (EVM)</label>
            <div className="flex gap-2">
              <input
                className={`flex-1 border rounded px-2 py-1 font-mono ${input && !valid ? 'border-red-500' : ''}`}
                placeholder="0x..."
                value={input}
                onChange={(e) => setInput(e.target.value.trim())}
              />
              <button className="px-3 py-1 border rounded" onClick={useConnected} disabled={!connected}>
                Use connected account
              </button>
            </div>
            {!valid && input && <div className="text-xs text-red-600 mt-1">Invalid address format.</div>}
          </div>

          <div className="flex gap-2">
            <button
              className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
              onClick={verify}
              disabled={!valid || busy}
            >
              {busy ? 'Verifying…' : 'Verify & Link with MetaMask'}
            </button>
            <button className="px-4 py-2 rounded border" onClick={() => disconnect()} disabled={!isConnected}>
              Disconnect MetaMask
            </button>
            <button className="px-4 py-2 rounded border" onClick={() => setDebug(null)}>
              Hide debug
            </button>
          </div>

          <div className="text-xs text-muted-foreground">
            MetaMask が署名ウィンドウを開きます。表示されない場合はポップアップブロックとロック状態を確認してください。
          </div>
        </div>
      )}

      {msg && <div className="text-sm">{msg}</div>}
      {debug && (
        <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-64">{JSON.stringify(debug, null, 2)}</pre>
      )}

      <hr className="my-4" />
      <h2 className="font-semibold">Linked wallets</h2>
      <div className="text-sm border rounded">
        <div className="grid grid-cols-2 font-semibold border-b px-3 py-2">
          <div>Address</div><div>Status</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-2 px-3 py-2 border-b last:border-b-0">
            <div className="font-mono break-all">{r.address}</div>
            <div>{r.verified ? '✅ verified' : '⏳ pending'}</div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-3 py-2">No wallets yet.</div>}
      </div>
    </div>
  )
}

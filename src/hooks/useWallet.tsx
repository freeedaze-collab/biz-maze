// src/hooks/useWallet.tsx
import { useAccount, useDisconnect, useConnect, useSignMessage } from 'wagmi'
import { getAddress } from 'viem'
import { supabase } from '@/lib/supabaseClient'

type Options = {
  requireAuth?: boolean // Supabaseログイン必須にするか
}

export function useWallet(opts: Options = {}) {
  const { isConnected, address } = useAccount()
  const { disconnectAsync } = useDisconnect()
  const { connectAsync, connectors, isPending: isConnecting } = useConnect()
  const { signMessageAsync } = useSignMessage()

  // SIWE簡易版：本番は本格SIWE(Nonce, domain, expiry)推奨
  const signInWithEthereum = async (addr: `0x${string}`) => {
    const message = `Link wallet to account: ${addr}`
    const signature = await signMessageAsync({ message })

    // SupabaseのセッションJWTを取得してEdge FunctionにBearerで渡す
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
    if (sessionErr) throw sessionErr
    const token = sessionData.session?.access_token
    const userId = sessionData.session?.user?.id
    if (!token || !userId) {
      throw new Error('No Supabase session. Please login first.')
    }

    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-wallet-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: addr, message, signature, userId }),
    })
    if (!resp.ok) {
      const t = await resp.text()
      throw new Error(`Signature verify failed: ${t}`)
    }
    return true
  }

  const connect = async () => {
    if (opts.requireAuth) {
      const { data: s } = await supabase.auth.getSession()
      if (!s.session) throw new Error('Login required before wallet connect.')
    }
    const connector = connectors[0] // injected or walletConnectなど
    await connectAsync({ connector })
    const addr = getAddress((address ?? '') as `0x${string}`) // 正規化
    if (addr) {
      await signInWithEthereum(addr)
    }
  }

  const disconnect = async () => {
    await disconnectAsync()
  }

  return {
    isConnected,
    address,
    isConnecting,
    connectors,
    connect,
    disconnect,
    signInWithEthereum,
  }
}

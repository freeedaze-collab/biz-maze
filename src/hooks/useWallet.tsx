// src/hooks/useWallet.tsx
import { useAccount, useDisconnect, useConnect, useSignMessage } from 'wagmi'
import { getAddress } from 'viem'
import { supabase, authHeaders } from '@/lib/supabaseClient'

type Options = {
  requireAuth?: boolean
}

export function useWallet(opts: Options = {}) {
  const { isConnected, address } = useAccount()
  const { disconnectAsync } = useDisconnect()
  const { connectAsync, connectors, isPending: isConnecting } = useConnect()
  const { signMessageAsync } = useSignMessage()

  const signInWithEthereum = async (addr: `0x${string}`) => {
    const message = `Link wallet to account: ${addr}`
    const signature = await signMessageAsync({ message })
    // ✅ ここを session の Bearer 優先に変更（anon固定をやめる）
    const headers = await authHeaders(true)
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-wallet-signature`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ address: addr, message, signature }),
    })
    if (!resp.ok) throw new Error(`Signature verification failed: ${await resp.text()}`)
  }

  const connectWallet = async () => {
    const connector = connectors.find(c => c.id === 'io.metamask' || c.id === 'injected') ?? connectors[0]
    if (!connector) throw new Error('No wallet connector available')

    const { accounts } = await connectAsync({ connector })
    const raw = accounts?.[0]
    if (!raw) throw new Error('No account returned from connector')
    const checksummed = getAddress(raw as `0x${string}`)

    if (opts.requireAuth) {
      await signInWithEthereum(checksummed)
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr) throw authErr
    if (user) {
      const { error } = await supabase.from('profiles').upsert(
        { id: user.id, wallet_address: checksummed },
        { onConflict: 'id' }
      )
      if (error) throw error
    }
    return checksummed
  }

  const disconnectWallet = async () => {
    await disconnectAsync()
  }

  return {
    isConnected,
    address: address ? getAddress(address as `0x${string}`) : null,
    connectWallet,
    disconnectWallet,
    isConnecting,
  }
}

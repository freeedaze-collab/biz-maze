// src/hooks/useWallet.tsx
import { useAccount, useDisconnect, useConnect, useSignMessage } from 'wagmi'
import { getAddress, isAddress } from 'viem'
import { supabase } from '@/lib/supabaseClient'

type Options = {
  requireAuth?: boolean // Supabaseログイン必須にするか
}

export function useWallet(opts: Options = {}) {
  const { isConnected, address } = useAccount()
  const { disconnectAsync } = useDisconnect()
  const { connectAsync, connectors, isPending: isConnecting } = useConnect()
  const { signMessageAsync } = useSignMessage()

  // 任意：SIWE風の簡易署名検証（Edge Function に合わせて文字列を固定）
  const signInWithEthereum = async (addr: `0x${string}`) => {
    const message = `Link wallet to account: ${addr}`
    const signature = await signMessageAsync({ message })
    // Edge Function verify-wallet-signature がある前提
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-wallet-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: addr, message, signature }),
    })
    if (!resp.ok) {
      const t = await resp.text()
      throw new Error(`Signature verification failed: ${t}`)
    }
  }

  const connectWallet = async () => {
    // 1) コネクタ選択（優先: injected → walletConnect）
    const injected = connectors.find(c => c.id === 'io.metamask' || c.id === 'injected')
    const connector = injected ?? connectors[0]
    if (!connector) throw new Error('No wallet connector available')

    const { accounts } = await connectAsync({ connector })
    const raw = accounts?.[0]
    if (!raw) throw new Error('No account returned from connector')

    const checksummed = getAddress(raw as `0x${string}`)

    // 2) 署名でリンク（必要に応じて）
    if (opts.requireAuth) {
      await signInWithEthereum(checksummed)
    }

    // 3) Supabase プロファイルへ保存（wallet_address）
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr) throw authErr
    if (!user) {
      // 未ログインでも接続自体は成功させる。リンクは後で。
      return checksummed
    }

    const { error: upsertErr } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        wallet_address: checksummed,
      },
      { onConflict: 'id' }
    )
    if (upsertErr) throw upsertErr

    return checksummed
  }

  const disconnectWallet = async () => {
    await disconnectAsync()
  }

  const ensureValidAddress = (addr?: string | null) => {
    if (!addr) return null
    try {
      const a = getAddress(addr as `0x${string}`)
      return a
    } catch {
      return null
    }
  }

  return {
    isConnected,
    address: ensureValidAddress(address),
    connectWallet,
    disconnectWallet,
    isConnecting,
  }
}

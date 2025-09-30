// src/components/WalletConnectButton.tsx
import React from 'react'
import { useWallet } from '@/hooks/useWallet'

type Props = {
  requireAuth?: boolean
  className?: string
}

export const WalletConnectButton: React.FC<Props> = ({ requireAuth, className }) => {
  const { isConnected, address, connectWallet, disconnectWallet, isConnecting } = useWallet({ requireAuth })

  return (
    <button
      className={className ?? 'px-4 py-2 rounded-xl border'}
      onClick={async () => {
        try {
          if (isConnected) {
            await disconnectWallet()
          } else {
            await connectWallet()
          }
        } catch (e: any) {
          alert(e?.message ?? 'Wallet connect failed')
        }
      }}
      disabled={isConnecting}
    >
      {isConnected ? `Connected: ${address?.slice(0, 6)}…${address?.slice(-4)}` : (isConnecting ? 'Connecting…' : 'Connect Wallet')}
    </button>
  )
}

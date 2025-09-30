// src/components/NavBar.tsx
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthSession } from '@/hooks/useAuthSession'
import { supabase } from '@/lib/supabaseClient'
import { WalletConnectButton } from '@/components/WalletConnectButton'

export function NavBar() {
  const nav = useNavigate()
  const { session } = useAuthSession()

  const signOut = async () => {
    await supabase.auth.signOut()
    nav('/', { replace: true })
  }

  return (
    <header className="border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="font-semibold">BizMaze</Link>

        <nav className="flex items-center gap-3 text-sm">
          {session ? (
            <>
              <Link to="/dashboard" className="hover:underline">Dashboard</Link>
              <Link to="/transactions" className="hover:underline">Transactions</Link>
              <Link to="/accounting" className="hover:underline">Accounting/Tax</Link>
              <Link to="/pricing" className="hover:underline">Pricing</Link>
              <Link to="/transfer" className="hover:underline">Transfer</Link>
              <WalletConnectButton className="px-3 py-1.5 rounded-md border" />
              <button className="px-3 py-1.5 rounded-md border" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-1.5 rounded-md border">Sign in</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

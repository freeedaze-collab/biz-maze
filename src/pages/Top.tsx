// src/pages/Top.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthSession } from '@/hooks/useAuthSession'

export default function Top() {
  const nav = useNavigate()
  const { session, checking } = useAuthSession()

  const onPrimary = () => {
    if (session) {
      nav('/dashboard', { replace: true })
    } else {
      nav('/login', { replace: true })
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-bold">Welcome</h1>
      <p className="text-gray-600">
        Connect your wallet, sync transactions, and generate accounting/tax reports.
      </p>

      <button
        className="px-5 py-3 rounded-xl border text-lg"
        onClick={onPrimary}
        disabled={checking}
      >
        {checking ? 'Checking…' : session ? 'Go to Dashboard' : 'Sign in'}
      </button>

      <div className="text-sm text-gray-500">
        {session ? 'You are signed in.' : 'You are not signed in.'}
      </div>
    </div>
  )
}

// src/components/AuthGuard.tsx
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthSession } from '@/hooks/useAuthSession'

type Props = { children: React.ReactNode }

export function AuthGuard({ children }: Props) {
  const loc = useLocation()
  const { session, checking } = useAuthSession()

  if (checking) return <div className="p-6">Checking authentication…</div>
  if (!session) return <Navigate to="/login" state={{ from: loc }} replace />

  return <>{children}</>
}

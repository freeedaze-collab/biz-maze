// src/components/GuestGuard.tsx
import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthSession } from '@/hooks/useAuthSession'

type Props = { children: React.ReactNode; redirect?: string }

export function GuestGuard({ children, redirect = '/dashboard' }: Props) {
  const { session, checking } = useAuthSession()
  if (checking) return <div className="p-6">Checking authentication…</div>
  if (session) return <Navigate to={redirect} replace />
  return <>{children}</>
}

// src/pages/Dashboard.tsx
import React from 'react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <ul className="list-disc pl-6">
        <li><Link className="underline" to="/transactions">Transaction History</Link></li>
        <li><Link className="underline" to="/accounting">Accounting / Tax</Link></li>
        <li><Link className="underline" to="/transfer">Transfer</Link></li>
        <li><Link className="underline" to="/pricing">Pricing</Link></li>
      </ul>
    </div>
  )
}

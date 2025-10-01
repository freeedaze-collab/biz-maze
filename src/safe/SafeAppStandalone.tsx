// src/safe/SafeAppStandalone.tsx
import React from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import DebugEnv from '@/pages/_DebugEnv'

function Health() {
  return (
    <div className="p-8 space-y-3">
      <h1 className="text-2xl font-bold">Safe mode</h1>
      <p>Router/外部初期化を最小化した描画確認ページです。</p>
      <ul className="list-disc pl-6">
        <li><Link className="underline" to="/">Home</Link></li>
        <li><Link className="underline" to="/_debug">/_debug</Link></li>
        <li><Link className="underline" to="/_health">/_health</Link></li>
      </ul>
    </div>
  )
}

function Home() {
  return (
    <div className="p-8 space-y-3">
      <h1 className="text-2xl font-bold">Home (Safe)</h1>
      <p>この画面が見えれば「ルーターと最低限の描画」は機能しています。</p>
      <p><Link className="underline" to="/_debug">環境の可視化 /_debug</Link></p>
    </div>
  )
}

/**
 * BrowserRouterをこのファイル内で自己完結させる。
 * App側のNavBarやAuthGuard等は一切読み込まない。
 */
export default function SafeAppStandalone() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/_debug" element={<DebugEnv />} />
        <Route path="/_health" element={<Health />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

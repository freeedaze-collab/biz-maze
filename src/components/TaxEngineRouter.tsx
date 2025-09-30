// src/components/TaxEngineRouter.tsx
import React from 'react'
import type { Database } from '@/integrations/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

// 既存の実装がある前提のダミーインポート名
// 実プロジェクトでは実体コンポーネント/関数を参照してください。
const IFRSReport = React.lazy(() => import('@/components/IFRSReport'))
const USTaxCalculator = React.lazy(() => import('@/components/USTaxCalculator'))

type Props = {
  profile?: Profile
}

export default function TaxEngineRouter({ profile }: Props) {
  const country = (profile?.tax_country ?? '').toUpperCase()

  // ここでは US → USTax、それ以外は IFRS という実用ルール
  const isUS = country === 'US' || country === 'USA' || country === 'UNITED STATES'

  return (
    <React.Suspense fallback={<div>Loading tax components…</div>}>
      {isUS ? <USTaxCalculator profile={profile} /> : <IFRSReport profile={profile} />}
    </React.Suspense>
  )
}

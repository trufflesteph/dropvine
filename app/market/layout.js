import { MarketConfigProvider } from '@/lib/markets/config-context'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import BottomNav from '@/components/markets/BottomNav'

export const metadata = {
  title: 'Market — Dropvine',
  description: 'A white-label progressive web app for seasonal farmers markets, powered by Dropvine.',
}

async function fetchActiveConfig() {
  try {
    const supa = getSupabaseAdmin()
    if (!supa) return null
    const { data } = await supa
      .from('market_config')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    return data || null
  } catch { return null }
}

export default async function MarketLayout({ children }) {
  const initialConfig = await fetchActiveConfig()
  return (
    <MarketConfigProvider initialConfig={initialConfig}>
      <div className="min-h-screen pb-20" style={{ background: 'var(--market-bg, #FAF7F2)' }}>
        {children}
        <BottomNav />
      </div>
    </MarketConfigProvider>
  )
}

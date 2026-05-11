'use client'
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'

const MarketConfigContext = createContext(null)

/**
 * MarketConfigProvider
 * ---------------------
 * Fetches the single active row from `public.market_config` via the
 * /api/market/config endpoint, exposes it through `useMarketConfig()`,
 * and applies the market's brand colors as CSS custom properties on
 * <html>:
 *   --market-primary, --market-accent, --market-bg
 */
export function MarketConfigProvider({ children, initialConfig = null }) {
  const [config, setConfig] = useState(initialConfig)
  const [loading, setLoading] = useState(!initialConfig)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/market/config', { cache: 'no-store' })
      if (!res.ok) throw new Error('failed to load market config')
      const json = await res.json()
      setConfig(json?.config || null)
      setError(null)
    } catch (e) {
      setError(e?.message || 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialConfig) refresh()
  }, [initialConfig, refresh])

  // Apply brand colours as CSS variables
  useEffect(() => {
    if (typeof document === 'undefined' || !config) return
    const root = document.documentElement
    if (config.primary_color) root.style.setProperty('--market-primary', config.primary_color)
    if (config.accent_color) root.style.setProperty('--market-accent', config.accent_color)
    if (config.pwa_background_color) root.style.setProperty('--market-bg', config.pwa_background_color)
    if (config.pwa_theme_color) root.style.setProperty('--market-theme', config.pwa_theme_color)
  }, [config])

  const value = useMemo(() => ({ config, loading, error, refresh }), [config, loading, error, refresh])
  return <MarketConfigContext.Provider value={value}>{children}</MarketConfigContext.Provider>
}

export function useMarketConfig() {
  const ctx = useContext(MarketConfigContext)
  if (!ctx) throw new Error('useMarketConfig must be used inside <MarketConfigProvider>')
  return ctx
}

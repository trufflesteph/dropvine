'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import MarketHeader from '@/components/markets/MarketHeader'
import { Camera, AlertCircle } from 'lucide-react'

function parseStampUrl(text) {
  // Accepts full URLs (https://.../market/stamp/<slug>) or bare slugs
  if (!text) return null
  try {
    const u = new URL(text)
    const m = u.pathname.match(/\/market\/stamp\/([^/?#]+)/)
    if (m) return m[1]
  } catch { /* not a URL */ }
  // Treat plain text as a vendor slug
  if (/^[a-z0-9-]+$/i.test(text)) return text
  return null
}

export default function ScanPage() {
  const router = useRouter()
  const containerRef = useRef(null)
  const scannerRef = useRef(null)
  const [error, setError] = useState(null)
  const [hint, setHint] = useState('Allow camera access to scan a booth QR.')

  useEffect(() => {
    let cancelled = false
    let scanner = null
    ;(async () => {
      try {
        const mod = await import('html5-qrcode')
        if (cancelled) return
        const Html5QrcodeScanner = mod.Html5QrcodeScanner
        scanner = new Html5QrcodeScanner('scanner-region', { fps: 10, qrbox: 240, rememberLastUsedCamera: true }, false)
        scannerRef.current = scanner
        scanner.render(
          (decodedText) => {
            const slug = parseStampUrl(decodedText)
            if (slug) {
              try { scanner.clear() } catch { /* noop */ }
              router.replace(`/market/stamp/${slug}`)
            } else {
              setHint('That QR didn’t look like a booth code. Keep scanning.')
            }
          },
          () => { /* scan fail per-frame: ignore */ },
        )
      } catch (e) {
        setError(e?.message || 'Failed to start camera')
      }
    })()
    return () => {
      cancelled = true
      try { scannerRef.current?.clear?.() } catch { /* noop */ }
    }
  }, [router])

  return (
    <main>
      <MarketHeader back title="Scan a booth" sub="Point at the QR to collect a stamp" />
      <div className="max-w-md mx-auto px-5 py-6">
        <div ref={containerRef} className="rounded-2xl overflow-hidden bg-stone-900 aspect-square">
          <div id="scanner-region" />
        </div>
        {error ? (
          <div className="mt-4 flex items-start gap-2 text-sm text-rose-700 bg-rose-50 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>{error}</div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-stone-600 inline-flex items-center gap-2">
            <Camera className="w-4 h-4" /> {hint}
          </p>
        )}
      </div>
    </main>
  )
}

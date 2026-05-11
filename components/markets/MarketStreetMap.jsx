'use client'
import React, { useMemo } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Adaptive street-schematic map.
 *
 * Driven entirely by `market_config`:
 *   - map_booth_count (e.g. 12)
 *   - map_orientation ('horizontal' | 'vertical')
 *   - map_street_name (e.g. 'Willamette Falls Drive')
 *   - map_cross_street_start / map_cross_street_end (e.g. '12th St', '15th St')
 *   - primary_color, accent_color
 *
 * Booths are placed in two rows along the street. Vendors with `booth_number`
 * occupy the corresponding booth (1-indexed). Empty booths render as light-grey
 * dashed outlines. Occupied booths are coloured by the vendor's first matching
 * category and clickable through to /market/v/[slug].
 */
const CATEGORY_COLORS = {
  produce: '#7B9E5C', eggs: '#D9C46E',
  bakery: '#B68660', pastries: '#C99A6A', pastry: '#C99A6A', bread: '#A87650',
  coffee: '#5B3F2C', drinks: '#7A4F35', tea: '#A88BB6', beans: '#5B3F2C', drink: '#7A4F35',
  food: '#C46B3A', tacos: '#C46B3A', burritos: '#C46B3A',
  apothecary: '#9C7BAA', wellness: '#9C7BAA',
  crafts: '#7A8DA1', ceramics: '#7A8DA1',
  flowers: '#D08FA0',
}

function colorFor(categories = [], accent = '#E2A93C') {
  for (const c of categories) {
    const k = String(c).toLowerCase()
    if (CATEGORY_COLORS[k]) return CATEGORY_COLORS[k]
  }
  return accent
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '\u2026' : s
}

export default function MarketStreetMap({ config, vendors = [] }) {
  const router = useRouter()

  const orientation = config?.map_orientation === 'vertical' ? 'vertical' : 'horizontal'
  const totalBooths = Math.max(2, Number(config?.map_booth_count) || 12)
  const accent = config?.accent_color || '#E2A93C'
  const primary = config?.primary_color || '#2F5233'
  const street = config?.map_street_name || 'Main Street'
  const startCross = config?.map_cross_street_start || ''
  const endCross = config?.map_cross_street_end || ''

  const vendorByBooth = useMemo(() => {
    const m = new Map()
    for (const v of vendors || []) {
      if (Number.isInteger(v?.booth_number)) m.set(v.booth_number, v)
    }
    return m
  }, [vendors])

  // Split booths between two rows along the street
  const topRow = Math.ceil(totalBooths / 2)
  const bottomRow = totalBooths - topRow

  if (orientation === 'horizontal') {
    const W = 1200
    const padX = 90
    const innerW = W - padX * 2
    const cells = Math.max(topRow, bottomRow)
    const gap = 8
    const boothW = (innerW - (cells - 1) * gap) / cells
    const boothH = 78
    const streetH = 64
    const topY = 24
    const streetY = topY + boothH + 12
    const bottomY = streetY + streetH + 12
    const H = bottomY + boothH + 24

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Street map of ${street}`}>
        {/* Background */}
        <rect x={0} y={0} width={W} height={H} fill="#F4EFE3" rx={12} />
        {/* Cross-street bands at each end */}
        <CrossStreetBand x={0} y={0} w={padX} h={H} label={startCross} primary={primary} />
        <CrossStreetBand x={W - padX} y={0} w={padX} h={H} label={endCross} primary={primary} />

        {/* Street body */}
        <rect x={padX} y={streetY} width={innerW} height={streetH} fill="#D9D2C2" />
        {/* Curb lines */}
        <line x1={padX} y1={streetY} x2={W - padX} y2={streetY} stroke="#B8AF99" strokeWidth={1.5} />
        <line x1={padX} y1={streetY + streetH} x2={W - padX} y2={streetY + streetH} stroke="#B8AF99" strokeWidth={1.5} />
        {/* Center dashed line */}
        <line x1={padX + 8} y1={streetY + streetH / 2} x2={W - padX - 8} y2={streetY + streetH / 2}
              stroke="#FFFEF8" strokeDasharray="18 14" strokeWidth={2} />
        {/* Street name */}
        <text x={W / 2} y={streetY + streetH / 2 + 6} textAnchor="middle"
              fill={primary} fontSize={20} fontFamily="serif" fontStyle="italic"
              style={{ paintOrder: 'stroke', stroke: '#F4EFE3', strokeWidth: 6, strokeLinejoin: 'round' }}>
          {street}
        </text>

        {/* Top row (booth numbers 1..topRow) */}
        {Array.from({ length: topRow }).map((_, i) => {
          const boothNum = i + 1
          const v = vendorByBooth.get(boothNum)
          const x = padX + i * (boothW + gap)
          return (
            <Booth
              key={`t${i}`}
              x={x} y={topY} w={boothW} h={boothH}
              vendor={v} accent={accent} number={boothNum}
              labelOnTop
              onClick={v ? () => router.push(`/market/v/${v.slug}`) : null}
            />
          )
        })}

        {/* Bottom row (booth numbers topRow+1 .. total) */}
        {Array.from({ length: bottomRow }).map((_, i) => {
          const boothNum = topRow + i + 1
          const v = vendorByBooth.get(boothNum)
          const x = padX + i * (boothW + gap)
          return (
            <Booth
              key={`b${i}`}
              x={x} y={bottomY} w={boothW} h={boothH}
              vendor={v} accent={accent} number={boothNum}
              onClick={v ? () => router.push(`/market/v/${v.slug}`) : null}
            />
          )
        })}
      </svg>
    )
  }

  // ---------------------- VERTICAL orientation ----------------------
  const W = 600
  const padY = 90
  const cells = Math.max(topRow, bottomRow)
  const gap = 8
  const boothH = (W - (cells - 1) * gap) / cells
  const boothW = 90
  const streetW = 64
  const leftX = 24
  const streetX = leftX + boothW + 12
  const rightX = streetX + streetW + 12
  const HV = padY * 2 + W
  const WV = rightX + boothW + 24
  return (
    <svg viewBox={`0 0 ${WV} ${HV}`} className="w-full h-auto" role="img" aria-label={`Street map of ${street}`}>
      <rect x={0} y={0} width={WV} height={HV} fill="#F4EFE3" rx={12} />
      <CrossStreetBand x={0} y={0} w={WV} h={padY} label={startCross} primary={primary} horizontal />
      <CrossStreetBand x={0} y={HV - padY} w={WV} h={padY} label={endCross} primary={primary} horizontal />
      <rect x={streetX} y={padY} width={streetW} height={W} fill="#D9D2C2" />
      <line x1={streetX} y1={padY} x2={streetX} y2={padY + W} stroke="#B8AF99" strokeWidth={1.5} />
      <line x1={streetX + streetW} y1={padY} x2={streetX + streetW} y2={padY + W} stroke="#B8AF99" strokeWidth={1.5} />
      <line x1={streetX + streetW / 2} y1={padY + 8} x2={streetX + streetW / 2} y2={padY + W - 8}
            stroke="#FFFEF8" strokeDasharray="18 14" strokeWidth={2} />
      <text x={streetX + streetW / 2} y={padY + W / 2}
            transform={`rotate(-90, ${streetX + streetW / 2}, ${padY + W / 2})`}
            textAnchor="middle" fill={primary} fontSize={20} fontFamily="serif" fontStyle="italic"
            style={{ paintOrder: 'stroke', stroke: '#F4EFE3', strokeWidth: 6, strokeLinejoin: 'round' }}>
        {street}
      </text>
      {Array.from({ length: topRow }).map((_, i) => {
        const boothNum = i + 1
        const v = vendorByBooth.get(boothNum)
        const y = padY + i * (boothH + gap)
        return <Booth key={`l${i}`} x={leftX} y={y} w={boothW} h={boothH} vendor={v} accent={accent} number={boothNum} onClick={v ? () => router.push(`/market/v/${v.slug}`) : null} />
      })}
      {Array.from({ length: bottomRow }).map((_, i) => {
        const boothNum = topRow + i + 1
        const v = vendorByBooth.get(boothNum)
        const y = padY + i * (boothH + gap)
        return <Booth key={`r${i}`} x={rightX} y={y} w={boothW} h={boothH} vendor={v} accent={accent} number={boothNum} onClick={v ? () => router.push(`/market/v/${v.slug}`) : null} />
      })}
    </svg>
  )
}

function CrossStreetBand({ x, y, w, h, label, primary, horizontal }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#ECE6DA" />
      <line
        x1={horizontal ? x : (x + w)} y1={horizontal ? (y + h) : y}
        x2={horizontal ? (x + w) : (x + w)} y2={horizontal ? (y + h) : (y + h)}
        stroke="#C9C0AE" strokeWidth={1}
      />
      {label ? (
        <text
          x={x + w / 2} y={y + h / 2 + 5}
          transform={horizontal ? undefined : `rotate(-90, ${x + w / 2}, ${y + h / 2})`}
          textAnchor="middle" fill={primary} fontSize={14} fontFamily="serif" letterSpacing="0.05em"
        >{label.toUpperCase()}</text>
      ) : null}
    </g>
  )
}

function Booth({ x, y, w, h, vendor, accent, number, onClick, labelOnTop }) {
  if (!vendor) {
    return (
      <g aria-label={`Booth ${number} \u2014 available`}>
        <rect x={x} y={y} width={w} height={h} rx={6}
              fill="rgba(255,255,255,0.55)"
              stroke="#C9C0AE" strokeWidth={1.5} strokeDasharray="6 5" />
        <text x={x + w / 2} y={y + h / 2 - 3} textAnchor="middle" fill="#A89E89" fontSize={11} letterSpacing="0.06em">AVAILABLE</text>
        <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fill="#C9C0AE" fontSize={10} fontFamily="monospace">#{number}</text>
      </g>
    )
  }
  const fill = colorFor(vendor.categories, accent)
  return (
    <g
      role="button"
      aria-label={`Booth ${number} \u2014 ${vendor.name}`}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' && onClick) onClick() }}
      style={{ cursor: 'pointer' }}
    >
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} opacity={0.94} />
      <rect x={x} y={y} width={w} height={h} rx={6} fill="none" stroke="rgba(0,0,0,0.18)" />
      <text x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle"
            fill="#FAF7F2" fontSize={13} fontWeight={500} fontFamily="serif">
        {truncate(vendor.name, Math.max(8, Math.floor(w / 9)))}
      </text>
      <text x={x + w / 2} y={y + h - 6} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={10} fontFamily="monospace">#{number}</text>
    </g>
  )
}

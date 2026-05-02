'use client'
import { useEffect, useState } from 'react'

export function Countdown({ target, size = 'md', subtle = false }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const t = new Date(target).getTime()
  const diff = Math.max(0, t - now)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const seconds = Math.floor((diff / 1000) % 60)

  const sizes = {
    sm: { num: 'text-2xl md:text-3xl', label: 'text-[10px]' },
    md: { num: 'text-4xl md:text-5xl', label: 'text-[11px]' },
    lg: { num: 'text-5xl md:text-7xl lg:text-8xl', label: 'text-xs' },
  }[size] || { num: 'text-4xl', label: 'text-[11px]' }

  const Cell = ({ value, label }) => (
    <div className="flex flex-col items-center md:items-start">
      <div className={`font-serif font-light tabular-nums tracking-tighter ${sizes.num}`}>{String(value).padStart(2, '0')}</div>
      <div className={`mt-2 uppercase tracking-[0.2em] ${sizes.label} ${subtle ? 'text-muted-foreground' : 'text-muted-foreground'}`}>{label}</div>
    </div>
  )

  return (
    <div className="flex items-start gap-8 md:gap-14">
      <Cell value={days} label="Days" />
      <span className={`font-serif font-extralight text-muted-foreground/40 ${sizes.num} leading-none`}> </span>
      <Cell value={hours} label="Hours" />
      <Cell value={minutes} label="Minutes" />
      <Cell value={seconds} label="Seconds" />
    </div>
  )
}

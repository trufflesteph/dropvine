'use client'
import { useEffect, useRef, useState } from 'react'
import s from '@/app/page.module.css'

// "Join the waitlist" on the homepage Premium Shop Annual card. Opens a small
// form inside the card; posts to /api/premium-waitlist. A repeat email gets
// the same success message as a new one.
export function PremiumWaitlistForm() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle') // idle | sending | done
  const [error, setError] = useState('')
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
  // Honeypot: hidden from people, often filled in by bots. The API ignores
  // any sign-up that arrives with it set.
  const [website, setWebsite] = useState('')
  const firstInput = useRef(null)

  useEffect(() => { if (open) firstInput.current?.focus() }, [open])

  if (status === 'done') {
    return <p className={s.waitlistDone} role="status">You&apos;re on the list. We&apos;ll email you when spots open.</p>
  }

  if (!open) {
    return (
      <button type="button" className={`${s.btnCream} ${s.waitlistBtn}`} onClick={() => setOpen(true)}>
        Join the waitlist
      </button>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    setError('')
    try {
      const r = await fetch('/api/premium-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, email, business_name: businessName, website }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || 'Something went wrong. Please try again.')
      setStatus('done')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setStatus('idle')
    }
  }

  return (
    <form className={s.waitlistForm} onSubmit={submit} aria-label="Join the Premium Shop Annual waitlist">
      <label className={s.waitlistLabel}>
        First name
        <input ref={firstInput} className={s.waitlistInput} type="text" required maxLength={100} autoComplete="given-name"
               value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </label>
      <label className={s.waitlistLabel}>
        Email
        <input className={s.waitlistInput} type="email" required maxLength={254} autoComplete="email"
               value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className={s.waitlistLabel}>
        Business name (optional)
        <input className={s.waitlistInput} type="text" maxLength={200} autoComplete="organization"
               value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
      </label>
      <div className={s.waitlistHoneypot} aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off"
                 value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      {error ? <p className={s.waitlistError} role="alert">{error}</p> : null}
      <button type="submit" className={`${s.btnCream} ${s.waitlistBtn}`} disabled={status === 'sending'}>
        {status === 'sending' ? 'Joining…' : 'Join the waitlist'}
      </button>
    </form>
  )
}

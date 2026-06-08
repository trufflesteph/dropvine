'use client'
//
// /review/[review_id] — public review submission page.
//
// Reached via the magic-link in the ReviewRequest email. The review_id is
// a UUID that's only ever known to the shopper that received the email.
//
// Flow:
//   1. On mount, GET /api/reviews/[id] → resolve vendor + drop names.
//   2. If status='pending' → show the form (stars + comment + name).
//   3. On submit, POST /api/reviews/submit → moderation email goes to ops.
//   4. Show thanks state.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Star, Loader2, Check } from 'lucide-react'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'

export default function ReviewSubmissionPage() {
  const params = useParams()
  const reviewId = params?.review_id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [review, setReview] = useState(null)

  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!reviewId) return
    ;(async () => {
      try {
        const r = await fetch(`/api/reviews/${reviewId}`)
        const d = await r.json()
        if (cancelled) return
        if (!r.ok) {
          setError(d?.error || 'We could not find that review.')
        } else if (d?.review?.status && d.review.status !== 'pending') {
          // Already submitted in a previous session — show the thanks
          // state without exposing what was filled in.
          setReview(d.review)
          setSubmitted(true)
        } else {
          setReview(d.review)
          if (d.review?.reviewer_name) setName(d.review.reviewer_name)
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Network error.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [reviewId])

  async function submit(e) {
    e?.preventDefault?.()
    if (!rating || rating < 1 || rating > 5) return
    setSubmitting(true)
    try {
      const r = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: reviewId,
          rating,
          comment: comment.trim() || null,
          reviewer_name: name.trim() || null,
        }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) {
        setError(d?.error || 'Something went wrong.')
      } else {
        setSubmitted(true)
      }
    } catch (e) {
      setError(e?.message || 'Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Nav />

      <main className="flex-1 container max-w-2xl py-24 md:py-32">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : error && !review ? (
          <div className="border border-dashed border-border p-10 md:p-16 text-center">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Hmm</div>
            <h1 className="font-serif font-light text-3xl tracking-tighter">{error}</h1>
            <p className="text-sm text-muted-foreground mt-4">
              The review link might have expired, or the review was already submitted.
            </p>
            <Link href="/" className="mt-8 inline-flex items-center gap-2 text-foreground/80 hover:text-foreground underline underline-offset-4 text-sm">← Back to Dropvine</Link>
          </div>
        ) : submitted ? (
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Got it</div>
            <h1 className="font-serif font-light text-4xl md:text-5xl tracking-tighter">
              Thanks for your review.
            </h1>
            <p className="mt-6 text-muted-foreground leading-relaxed max-w-md mx-auto">
              It'll appear on {review?.vendor_name || 'the maker'}'s profile shortly — usually within a day.
            </p>
            {review?.vendor_slug ? (
              <Link
                href={`/direct/${review.vendor_slug}`}
                className="mt-10 inline-flex items-center gap-2 text-background px-6 py-3 text-sm hover:opacity-90"
                style={{ backgroundColor: '#2D4A2A' }}
              >
                Visit {review.vendor_name || 'their profile'} →
              </Link>
            ) : (
              <Link href="/drops" className="mt-10 inline-flex items-center gap-2 text-background px-6 py-3 text-sm hover:opacity-90" style={{ backgroundColor: '#2D4A2A' }}>
                Browse fresh drops →
              </Link>
            )}
          </div>
        ) : (
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Review</div>
            <h1 className="font-serif font-light text-4xl md:text-5xl tracking-tighter text-balance">
              How was your order from {review?.vendor_name || 'this maker'}?
            </h1>
            {review?.drop_title ? (
              <p className="mt-3 text-muted-foreground text-sm">From <em>{review.drop_title}</em></p>
            ) : null}

            <form onSubmit={submit} className="mt-12 space-y-10">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Your rating</label>
                <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Star rating">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = (hover || rating) >= n
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={rating === n}
                        aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
                        onClick={() => setRating(n)}
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(0)}
                        className="p-1 transition"
                      >
                        <Star
                          className={`h-9 w-9 ${active ? 'fill-current' : ''}`}
                          style={{ color: active ? '#2D4A2A' : 'rgba(0,0,0,0.18)' }}
                        />
                      </button>
                    )
                  })}
                </div>
                {rating ? <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{rating}/5</div> : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="review-comment" className="block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Comment (optional)</label>
                <textarea
                  id="review-comment"
                  rows={5}
                  value={comment}
                  maxLength={2000}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What went well? What could be better? Skip this if you'd rather leave just a rating."
                  className="w-full px-4 py-3 bg-background border border-border focus:border-foreground focus:outline-none text-sm leading-relaxed transition-colors resize-y"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="review-name" className="block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Your name</label>
                <input
                  id="review-name"
                  type="text"
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="First name + last initial is fine"
                  className="w-full px-4 py-3 bg-background border border-border focus:border-foreground focus:outline-none text-sm transition-colors"
                />
                <p className="text-xs text-muted-foreground">
                  We'll show your first name and the initial of your last name — e.g. <em>Sarah J.</em>
                </p>
              </div>

              {error ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={submitting || !rating}
                className="inline-flex items-center gap-2 text-background px-6 py-3 text-sm hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#2D4A2A' }}
              >
                {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>) : 'Submit review'}
              </button>
              <p className="text-xs text-muted-foreground -mt-4">
                Your review will appear on {review?.vendor_name || 'the maker'}'s profile after a quick check.
              </p>
            </form>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

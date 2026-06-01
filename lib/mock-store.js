// In-memory mock store used when Supabase env vars are missing.
// Persists for the life of the Node process. Good enough for UI dev.
import { v4 as uuidv4 } from 'uuid'

globalThis.__dropvine_store ||= {
  users: new Map(), // email -> { id, email, password, display_name }
  sessions: new Map(), // token -> userId
  drops: new Map(), // id -> drop
  waitlist: [], // entries
  reservations: [], // entries
}

export const store = globalThis.__dropvine_store

export function seedDemoLaunches() {
  if (store.drops.size > 0) return
  const demoUserId = 'demo-user'
  const now = Date.now()
  const demos = [
    {
      id: uuidv4(),
      creator_id: demoUserId,
      handle: 'maison-noir-fw26',
      title: 'Maison Noir — Fall/Winter Capsule',
      tagline: 'A study in shadow. 12 pieces. Limited to 200.',
      description: 'A meditative collection drawing from the architecture of light. Pre-orders open at the moment the timer reaches zero. Reservations hold your size for 24 hours after release.',
      cover_url: '',
      launch_at: new Date(now + 1000 * 60 * 60 * 36).toISOString(),
      price_cents: 48000,
      reservation_enabled: true,
      reservation_hold_cents: 5000,
      status: 'published',
      created_at: new Date().toISOString(),
    },
  ]
  demos.forEach(d => store.drops.set(d.id, d))
}
seedDemoLaunches()

export { uuidv4 }

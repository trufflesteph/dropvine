// Server-only data for /makers. Reads with the service-role client, the same
// client /api/direct/[slug] uses for the vendor page, and runs every vendor
// through buildMakerCard (the shared visibility rule), so the list is exactly
// the vendors whose /direct/[slug] page shows a profile.
//
// Cached for 5 minutes with unstable_cache: the page itself is dynamic (it
// reads searchParams), but every filter/page view of it shares one cached
// read. Errors throw, so a failed read isn't cached.

import { unstable_cache } from 'next/cache'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { buildMakerCard } from '@/lib/makers/directory'

export const MAKERS_REVALIDATE_SECONDS = 300

async function loadVisibleMakers() {
  const supa = getSupabaseAdmin()
  if (!supa) {
    console.warn('[makers] supabase not configured; listing no makers')
    return []
  }

  // Columns needed for the visibility rule + the public card. No email,
  // phone, venmo or other private fields are selected.
  const { data: vendors, error: vErr } = await supa
    .from('direct_vendors')
    .select('slug, business_name, bio, photo_url, logo_url, category, location_city, location_state, tier, active, is_demo, creator_id')
    .eq('active', true)
  if (vErr) throw new Error(`[makers] direct_vendors read failed: ${vErr.message}`)

  const creatorIds = (vendors || []).map((v) => v.creator_id).filter(Boolean)
  const dropsByCreator = new Map()
  if (creatorIds.length) {
    // Same status set the vendor page's API reads.
    const { data: drops, error: dErr } = await supa
      .from('drops')
      .select('creator_id, status, launch_at, closes_at, cover_url, created_at')
      .in('creator_id', creatorIds)
      .in('status', ['published', 'scheduled'])
    if (dErr) throw new Error(`[makers] drops read failed: ${dErr.message}`)
    for (const d of drops || []) {
      if (!dropsByCreator.has(d.creator_id)) dropsByCreator.set(d.creator_id, [])
      dropsByCreator.get(d.creator_id).push(d)
    }
  }

  const now = Date.now()
  return (vendors || [])
    .map((v) => buildMakerCard(v, (v.creator_id && dropsByCreator.get(v.creator_id)) || [], now))
    .filter(Boolean)
}

export const getVisibleMakers = unstable_cache(loadVisibleMakers, ['makers-directory-v1'], {
  revalidate: MAKERS_REVALIDATE_SECONDS,
  tags: ['makers'],
})

// POST   /api/direct/me/image   multipart: file, kind = 'photo' | 'logo'
// DELETE /api/direct/me/image?kind=photo|logo
//
// The signed-in vendor's profile photo and logo, from /dashboard/settings.
// POST stores the file in the public `vendor-photos` bucket at
// vendors/<vendor_id>/<kind>-<timestamp>.<ext> and saves its public URL to
// direct_vendors.photo_url or logo_url. DELETE sets the column to null (the
// file stays in storage).
//
// JPG, PNG and WebP up to 5 MB, checked from the file's bytes rather than its
// name or reported type. HEIC/HEIF (iPhone) is converted to JPEG with the same
// converter the Tally drop photos use.
//
// Auth: the signed-in user from the Supabase session (lib/auth/server-user.js);
// the vendor row is looked up by creator_id, never taken from the request.

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getSignedInUserId } from '@/lib/auth/server-user'
import { convertHeicToJpeg } from '@/lib/markets/tally-images'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'vendor-photos'
const MAX_BYTES = 5 * 1024 * 1024
const COLUMNS = { photo: 'photo_url', logo: 'logo_url' }
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const WRONG_TYPE = 'Please upload a JPG, PNG or WebP image.'
const HEIC_FAILED = 'Please upload a JPG or PNG. On iPhone: Settings > Camera > Formats > Most Compatible.'

function bad(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// 'jpg' | 'png' | 'webp' | 'heic' | null, from the file's first bytes.
function sniffType(buf) {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (buf.toString('ascii', 4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(buf.toString('ascii', 8, 12))) return 'heic'
  return null
}

export async function POST(request) {
  const userId = await getSignedInUserId(request)
  if (!userId) return bad('not signed in', 401)

  let form
  try { form = await request.formData() } catch { return bad('Choose an image to upload.') }
  const kind = String(form.get('kind') || '')
  const column = COLUMNS[kind]
  if (!column) return bad('kind must be photo or logo')
  const file = form.get('file')
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) return bad('Choose an image to upload.')
  if (file.size > MAX_BYTES) {
    return bad(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please choose one under 5 MB.`)
  }

  let buf = Buffer.from(await file.arrayBuffer())
  let ext = sniffType(buf)
  if (ext === 'heic') {
    try {
      buf = await convertHeicToJpeg(buf)
      ext = 'jpg'
    } catch (e) {
      console.warn('[direct/me/image] HEIC conversion failed', { user_id: userId, error: e?.message || String(e) })
      return bad(HEIC_FAILED)
    }
  }
  if (!TYPES[ext]) return bad(WRONG_TYPE)

  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)
  const { data: vendor, error: vErr } = await supa.from('direct_vendors')
    .select('id').eq('creator_id', userId).maybeSingle()
  if (vErr) return bad(vErr.message, 500)
  if (!vendor) return bad('vendor row not yet provisioned', 404)

  const path = `vendors/${vendor.id}/${kind}-${Date.now()}.${ext}`
  const { error: upErr } = await supa.storage.from(BUCKET).upload(path, buf, {
    contentType: TYPES[ext],
    upsert: false,
    cacheControl: '31536000',
  })
  if (upErr) {
    console.error('[direct/me/image] upload failed', { vendor_id: vendor.id, path, error: upErr.message || String(upErr) })
    return bad('Could not upload that image. Please try again.', 500)
  }
  const publicUrl = supa.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl
  if (!publicUrl) return bad('Could not upload that image. Please try again.', 500)

  const { data, error } = await supa.from('direct_vendors')
    .update({ [column]: publicUrl })
    .eq('id', vendor.id)
    .eq('creator_id', userId)
    .select('photo_url, logo_url')
    .maybeSingle()
  if (error || !data) {
    console.error('[direct/me/image] save failed', { vendor_id: vendor.id, column, error: error?.message || 'no row' })
    await supa.storage.from(BUCKET).remove([path]).catch(() => {})
    return bad('Could not save that image. Please try again.', 500)
  }
  return NextResponse.json({ ok: true, photo_url: data.photo_url, logo_url: data.logo_url })
}

export async function DELETE(request) {
  const userId = await getSignedInUserId(request)
  if (!userId) return bad('not signed in', 401)
  const kind = new URL(request.url).searchParams.get('kind') || ''
  const column = COLUMNS[kind]
  if (!column) return bad('kind must be photo or logo')

  const supa = getSupabaseAdmin()
  if (!supa) return bad('supabase not configured', 500)
  const { data, error } = await supa.from('direct_vendors')
    .update({ [column]: null })
    .eq('creator_id', userId)
    .select('photo_url, logo_url')
    .maybeSingle()
  if (error) return bad(error.message, 500)
  if (!data) return bad('vendor row not yet provisioned', 404)
  return NextResponse.json({ ok: true, photo_url: data.photo_url, logo_url: data.logo_url })
}

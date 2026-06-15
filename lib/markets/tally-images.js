// lib/markets/tally-images.js
//
// Tally hosts uploaded images on its own storage with short-lived JWT
// access tokens baked into the URL. Storing those URLs directly into
// drops.cover_url / drops.photo_urls means the public drop page will 403
// the moment Tally rotates the token (typically <24h).
//
// This helper fetches each image at webhook time and uploads it into the
// Supabase `vendor-photos` bucket with a stable filename. The returned
// URL is permanent and publicly readable.
//
// Used by /api/webhooks/tally-direct-drop. Failures are non-fatal —
// callers fall back to the original Tally URL so the drop still has a
// cover image during the few hours before the token expires.

import crypto from 'crypto'
import sharp from 'sharp'

const BUCKET = 'vendor-photos'
// Max single image size we'll proxy (8 MB). Tally caps free-tier uploads
// at 10 MB so this is generous.
const MAX_BYTES = 8 * 1024 * 1024
// Keep well under Vercel Hobby's 15 s function limit. With DB operations
// before the proxy, 6 s leaves enough headroom for the rest of the webhook.
const FETCH_TIMEOUT_MS = 6000

function isHeic({ mimeType, name, url }) {
  const mime = String(mimeType || '').toLowerCase()
  if (mime === 'image/heic' || mime === 'image/heif') return true
  // application/octet-stream with a .heic/.heif filename is common on iOS uploads
  const filename = String(name || '') + String(url || '')
  return /\.heic(?:\?|$)/i.test(filename) || /\.heif(?:\?|$)/i.test(filename)
}

async function convertHeicToJpeg(buf) {
  return sharp(buf).jpeg({ quality: 90 }).toBuffer()
}

function inferExtension({ mimeType, name, url }) {
  const fromName = (name || '').match(/\.(jpg|jpeg|png|webp|gif|heic|heif|avif)(?:\?|$)/i)
  if (fromName) return fromName[1].toLowerCase()
  const fromUrl = String(url || '').match(/\.(jpg|jpeg|png|webp|gif|heic|heif|avif)(?:\?|$)/i)
  if (fromUrl) return fromUrl[1].toLowerCase()
  const m = String(mimeType || '').toLowerCase()
  if (m.includes('jpeg')) return 'jpg'
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'
  if (m.includes('gif')) return 'gif'
  if (m.includes('heic')) return 'heic'
  if (m.includes('heif')) return 'heif'
  if (m.includes('avif')) return 'avif'
  return 'jpg'
}

/**
 * Fetch a Tally-hosted image and re-upload it to Supabase storage.
 * Returns the public URL on success, null on any failure.
 *
 * @param {object}   args
 * @param {object}   args.supa   - Supabase admin client (service-role).
 * @param {string}   args.url    - Tally image URL (with short-lived token).
 * @param {string}   args.path   - Storage key (e.g. "drop-abc-cover.jpg").
 * @param {string}   args.mimeType
 */
export async function proxyImageToSupabase({ supa, url, path, mimeType }) {
  if (!supa || !url || !path) return null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    let res
    try {
      res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Dropvine-ImageProxy/1.0' },
      })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) {
      console.warn('[tally-images] fetch failed', res.status, url)
      return null
    }
    // Reject anything obviously too large up front.
    const len = parseInt(res.headers.get('content-length') || '0', 10)
    if (len && len > MAX_BYTES) {
      console.warn('[tally-images] image too large', len, 'bytes —', url)
      return null
    }
    let buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) {
      console.warn('[tally-images] image too large after fetch', buf.byteLength, 'bytes —', url)
      return null
    }
    let contentType = mimeType || res.headers.get('content-type') || 'application/octet-stream'
    // HEIC/HEIF images from iOS devices are not renderable in browsers.
    // Convert to JPEG before uploading so the public drop page can display them.
    if (isHeic({ mimeType: contentType, name: path, url })) {
      try {
        buf = await convertHeicToJpeg(buf)
        contentType = 'image/jpeg'
        path = path.replace(/\.hei[cf]$/i, '.jpg')
        console.log('[tally-images] HEIC→JPEG conversion done, new path:', path)
      } catch (convErr) {
        console.warn('[tally-images] HEIC conversion failed, uploading original:', convErr?.message || convErr)
      }
    }
    const { error: upErr } = await supa
      .storage
      .from(BUCKET)
      .upload(path, buf, {
        contentType,
        upsert: true,        // idempotent if the webhook re-runs
        cacheControl: '31536000',
      })
    if (upErr) {
      // Bucket doesn't exist or RLS misconfig — log + bail.
      console.warn('[tally-images] supabase upload failed:', upErr.message || upErr)
      return null
    }
    const { data } = supa.storage.from(BUCKET).getPublicUrl(path)
    return data?.publicUrl || null
  } catch (e) {
    console.warn('[tally-images] proxy crashed (non-fatal):', e?.message || e)
    return null
  }
}

/**
 * Upload a list of Tally file objects (one per gallery slot) and return
 * the new Supabase public URLs in input order. Failed uploads are
 * filtered out, so the result length may be < input length.
 *
 * @param {object} args
 * @param {object} args.supa    - Supabase admin client.
 * @param {string} args.dropId  - The drop UUID (used in storage path).
 * @param {string} args.prefix  - 'cover' or 'photo'.
 * @param {Array}  args.files   - [{url, name, mimeType}, …]
 */
export async function proxyTallyImages({ supa, dropId, prefix, files }) {
  if (!supa || !dropId || !Array.isArray(files) || files.length === 0) return []
  const out = []
  let i = 0
  for (const f of files) {
    if (!f?.url) continue
    const ext = inferExtension(f)
    // Random suffix avoids collisions when a vendor re-submits with the
    // same image. UUID-style 8-char base32 keeps the key short.
    const suffix = crypto.randomBytes(6).toString('base64url').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)
    const path = files.length === 1
      ? `drop-${dropId}-${prefix}-${suffix}.${ext}`
      : `drop-${dropId}-${prefix}-${i}-${suffix}.${ext}`
    i += 1
    const url = await proxyImageToSupabase({ supa, url: f.url, path, mimeType: f.mimeType })
    if (url) out.push(url)
  }
  return out
}

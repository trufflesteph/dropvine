'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Nav } from '@/components/dropvine/nav'
import { Footer } from '@/components/dropvine/footer'
import { Countdown } from '@/components/dropvine/countdown'
import { ArrowRight, ArrowUpRight } from 'lucide-react'

const NICHE_SVG = {
  ceramic:    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2MDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjAwIDQwMCc+PHJlY3Qgd2lkdGg9JzYwMCcgaGVpZ2h0PSc0MDAnIGZpbGw9JyNjNDg0NWEnLz48ZWxsaXBzZSBjeD0nMzAwJyBjeT0nMzQwJyByeD0nMTYwJyByeT0nMzAnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzhiNGUyYScgc3Ryb2tlLXdpZHRoPSczJyBvcGFjaXR5PScwLjUnLz48ZWxsaXBzZSBjeD0nMzAwJyBjeT0nMjAwJyByeD0nMTAwJyByeT0nMTYwJyBmaWxsPSdub25lJyBzdHJva2U9JyM4YjRlMmEnIHN0cm9rZS13aWR0aD0nMi41JyBvcGFjaXR5PScwLjQnLz48ZWxsaXBzZSBjeD0nMzAwJyBjeT0nMjAwJyByeD0nNzAnIHJ5PScxNDAnIGZpbGw9J25vbmUnIHN0cm9rZT0nI2U4YjA5MCcgc3Ryb2tlLXdpZHRoPScyJyBvcGFjaXR5PScwLjQnLz48ZWxsaXBzZSBjeD0nMzAwJyBjeT0nMjAwJyByeD0nNDAnIHJ5PScxMDAnIGZpbGw9J25vbmUnIHN0cm9rZT0nI2U4YjA5MCcgc3Ryb2tlLXdpZHRoPScxLjUnIG9wYWNpdHk9JzAuMycvPjxsaW5lIHgxPSczMDAnIHkxPSc0MCcgeDI9JzMwMCcgeTI9JzM3MCcgc3Ryb2tlPScjOGI0ZTJhJyBzdHJva2Utd2lkdGg9JzEnIG9wYWNpdHk9JzAuMjUnLz48cGF0aCBkPSdNMjMwIDgwIFEzMDAgNjAgMzcwIDgwJyBmaWxsPSdub25lJyBzdHJva2U9JyNlOGIwOTAnIHN0cm9rZS13aWR0aD0nMicgb3BhY2l0eT0nMC41Jy8+PHBhdGggZD0nTTIwMCAyMDAgUTMwMCAxODAgNDAwIDIwMCcgZmlsbD0nbm9uZScgc3Ryb2tlPScjOGI0ZTJhJyBzdHJva2Utd2lkdGg9JzEuNScgb3BhY2l0eT0nMC4zJy8+PHBhdGggZD0nTTIyMCAzMDAgUTMwMCAyODUgMzgwIDMwMCcgZmlsbD0nbm9uZScgc3Ryb2tlPScjOGI0ZTJhJyBzdHJva2Utd2lkdGg9JzEuNScgb3BhY2l0eT0nMC4zJy8+PC9zdmc+",
  tattoo:     "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2MDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjAwIDQwMCc+PHJlY3Qgd2lkdGg9JzYwMCcgaGVpZ2h0PSc0MDAnIGZpbGw9JyMyYTI0MjAnLz48cGF0aCBkPSdNMTgwIDIwMCBDMTgwIDE0MCAyMjAgMTAwIDMwMCAxMDAgQzM4MCAxMDAgNDIwIDE0MCA0MjAgMjAwIEM0MjAgMjYwIDM4MCAzMDAgMzAwIDMwMCBDMjIwIDMwMCAxODAgMjYwIDE4MCAyMDBaJyBmaWxsPSdub25lJyBzdHJva2U9JyNjOGE4ODInIHN0cm9rZS13aWR0aD0nMS41JyBvcGFjaXR5PScwLjM1Jy8+PHBhdGggZD0nTTMwMCAxMDAgTDMwMCAzMDAgTTE4MCAyMDAgTDQyMCAyMDAnIHN0cm9rZT0nI2M4YTg4Micgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjInLz48cGF0aCBkPSdNMjQwIDE0MCBDMjYwIDEyMCAyODAgMTMwIDMwMCAxMjAgQzMyMCAxMTAgMzQwIDEyNSAzNjAgMTQwJyBmaWxsPSdub25lJyBzdHJva2U9JyNjOGE4ODInIHN0cm9rZS13aWR0aD0nMS41JyBvcGFjaXR5PScwLjQnLz48cGF0aCBkPSdNMjMwIDIwMCBDMjUwIDE5MCAyNzAgMjEwIDMwMCAyMDAgQzMzMCAxOTAgMzUwIDIxMCAzNzAgMjAwJyBmaWxsPSdub25lJyBzdHJva2U9JyNjOGE4ODInIHN0cm9rZS13aWR0aD0nMS41JyBvcGFjaXR5PScwLjQnLz48Y2lyY2xlIGN4PSczMDAnIGN5PScyMDAnIHI9JzgnIGZpbGw9J25vbmUnIHN0cm9rZT0nI2M4YTg4Micgc3Ryb2tlLXdpZHRoPScxLjUnIG9wYWNpdHk9JzAuNCcvPjxjaXJjbGUgY3g9JzMwMCcgY3k9JzIwMCcgcj0nNDAnIGZpbGw9J25vbmUnIHN0cm9rZT0nI2M4YTg4Micgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjInLz48Y2lyY2xlIGN4PSczMDAnIGN5PScyMDAnIHI9JzgwJyBmaWxsPSdub25lJyBzdHJva2U9JyNjOGE4ODInIHN0cm9rZS13aWR0aD0nMC43NScgb3BhY2l0eT0nMC4xNScvPjxwYXRoIGQ9J00yNzAgMTcwIEwzMDAgMTUwIEwzMzAgMTcwIEwzMjAgMjA1IEwyODAgMjA1WicgZmlsbD0nbm9uZScgc3Ryb2tlPScjYzhhODgyJyBzdHJva2Utd2lkdGg9JzEnIG9wYWNpdHk9JzAuMycvPjwvc3ZnPg==",
  print:      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2MDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjAwIDQwMCc+PHJlY3Qgd2lkdGg9JzYwMCcgaGVpZ2h0PSc0MDAnIGZpbGw9JyNlOGUwZDAnLz48cmVjdCB4PScxMjAnIHk9JzYwJyB3aWR0aD0nMzYwJyBoZWlnaHQ9JzI4MCcgZmlsbD0nbm9uZScgc3Ryb2tlPScjNWE0ZTNhJyBzdHJva2Utd2lkdGg9JzEuNScgb3BhY2l0eT0nMC4zNScvPjxyZWN0IHg9JzE0MCcgeT0nODAnIHdpZHRoPSczMjAnIGhlaWdodD0nMjQwJyBmaWxsPSdub25lJyBzdHJva2U9JyM1YTRlM2EnIHN0cm9rZS13aWR0aD0nMC43NScgb3BhY2l0eT0nMC4yJy8+PGxpbmUgeDE9JzEyMCcgeTE9JzEyMCcgeDI9JzQ4MCcgeTI9JzEyMCcgc3Ryb2tlPScjNWE0ZTNhJyBzdHJva2Utd2lkdGg9JzAuNzUnIG9wYWNpdHk9JzAuMicvPjxsaW5lIHgxPScxMjAnIHkxPScxNjAnIHgyPSc0ODAnIHkyPScxNjAnIHN0cm9rZT0nIzVhNGUzYScgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjE1Jy8+PGxpbmUgeDE9JzEyMCcgeTE9JzIwMCcgeDI9JzQ4MCcgeTI9JzIwMCcgc3Ryb2tlPScjNWE0ZTNhJyBzdHJva2Utd2lkdGg9JzAuNzUnIG9wYWNpdHk9JzAuMTUnLz48bGluZSB4MT0nMTIwJyB5MT0nMjQwJyB4Mj0nNDgwJyB5Mj0nMjQwJyBzdHJva2U9JyM1YTRlM2EnIHN0cm9rZS13aWR0aD0nMC43NScgb3BhY2l0eT0nMC4xNScvPjxsaW5lIHgxPScxMjAnIHkxPScyODAnIHgyPSc0ODAnIHkyPScyODAnIHN0cm9rZT0nIzVhNGUzYScgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjInLz48cmVjdCB4PScxNTUnIHk9Jzk1JyB3aWR0aD0nMTMwJyBoZWlnaHQ9JzExMCcgZmlsbD0nIzVhNGUzYScgb3BhY2l0eT0nMC4xMicvPjxyZWN0IHg9JzMxMCcgeT0nOTUnIHdpZHRoPScxMzAnIGhlaWdodD0nNTAnIGZpbGw9JyM1YTRlM2EnIG9wYWNpdHk9JzAuMScvPjxsaW5lIHgxPSczMTAnIHkxPScxNjUnIHgyPSc0NDAnIHkyPScxNjUnIHN0cm9rZT0nIzVhNGUzYScgc3Ryb2tlLXdpZHRoPSc0JyBvcGFjaXR5PScwLjEnLz48bGluZSB4MT0nMzEwJyB5MT0nMTc1JyB4Mj0nNDIwJyB5Mj0nMTc1JyBzdHJva2U9JyM1YTRlM2EnIHN0cm9rZS13aWR0aD0nNCcgb3BhY2l0eT0nMC4xJy8+PGxpbmUgeDE9JzMxMCcgeTE9JzE4NScgeDI9JzQzMCcgeTI9JzE4NScgc3Ryb2tlPScjNWE0ZTNhJyBzdHJva2Utd2lkdGg9JzQnIG9wYWNpdHk9JzAuMScvPjxjaXJjbGUgY3g9JzU0MCcgY3k9JzYwJyByPScyNScgZmlsbD0nbm9uZScgc3Ryb2tlPScjNWE0ZTNhJyBzdHJva2Utd2lkdGg9JzEnIG9wYWNpdHk9JzAuMjUnLz48dGV4dCB4PSc1MjgnIHk9JzY1JyBmb250LWZhbWlseT0nc2VyaWYnIGZvbnQtc2l6ZT0nMTMnIGZpbGw9JyM1YTRlM2EnIG9wYWNpdHk9JzAuMyc+MDE8L3RleHQ+PC9zdmc+",
  photo:      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2MDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjAwIDQwMCc+PHJlY3Qgd2lkdGg9JzYwMCcgaGVpZ2h0PSc0MDAnIGZpbGw9JyMxZTI1MzAnLz48cmVjdCB4PScxNTAnIHk9JzgwJyB3aWR0aD0nMzAwJyBoZWlnaHQ9JzI0MCcgcng9JzQnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzgwOTBhOCcgc3Ryb2tlLXdpZHRoPScxLjUnIG9wYWNpdHk9JzAuNCcvPjxjaXJjbGUgY3g9JzMwMCcgY3k9JzIwMCcgcj0nODAnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzgwOTBhOCcgc3Ryb2tlLXdpZHRoPScxLjUnIG9wYWNpdHk9JzAuMzUnLz48Y2lyY2xlIGN4PSczMDAnIGN5PScyMDAnIHI9JzU1JyBmaWxsPSdub25lJyBzdHJva2U9JyM4MDkwYTgnIHN0cm9rZS13aWR0aD0nMScgb3BhY2l0eT0nMC4yNScvPjxjaXJjbGUgY3g9JzMwMCcgY3k9JzIwMCcgcj0nMzAnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzgwOTBhOCcgc3Ryb2tlLXdpZHRoPScxJyBvcGFjaXR5PScwLjInLz48Y2lyY2xlIGN4PSczMDAnIGN5PScyMDAnIHI9JzEwJyBmaWxsPScjODA5MGE4JyBvcGFjaXR5PScwLjInLz48bGluZSB4MT0nMTUwJyB5MT0nMjAwJyB4Mj0nMjIwJyB5Mj0nMjAwJyBzdHJva2U9JyM4MDkwYTgnIHN0cm9rZS13aWR0aD0nMC43NScgb3BhY2l0eT0nMC4yNScvPjxsaW5lIHgxPSczODAnIHkxPScyMDAnIHgyPSc0NTAnIHkyPScyMDAnIHN0cm9rZT0nIzgwOTBhOCcgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjI1Jy8+PGxpbmUgeDE9JzMwMCcgeTE9JzgwJyB4Mj0nMzAwJyB5Mj0nMTIwJyBzdHJva2U9JyM4MDkwYTgnIHN0cm9rZS13aWR0aD0nMC43NScgb3BhY2l0eT0nMC4yNScvPjxsaW5lIHgxPSczMDAnIHkxPScyODAnIHgyPSczMDAnIHkyPSczMjAnIHN0cm9rZT0nIzgwOTBhOCcgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjI1Jy8+PHJlY3QgeD0nMjcwJyB5PSc2MCcgd2lkdGg9JzYwJyBoZWlnaHQ9JzIwJyByeD0nMycgZmlsbD0nbm9uZScgc3Ryb2tlPScjODA5MGE4JyBzdHJva2Utd2lkdGg9JzEnIG9wYWNpdHk9JzAuMycvPjxyZWN0IHg9JzQ1MCcgeT0nODUnIHdpZHRoPSc0MCcgaGVpZ2h0PScyOCcgcng9JzE0JyBmaWxsPSdub25lJyBzdHJva2U9JyM4MDkwYTgnIHN0cm9rZS13aWR0aD0nMScgb3BhY2l0eT0nMC4yNScvPjwvc3ZnPg==",
  vintage:    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2MDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjAwIDQwMCc+PHJlY3Qgd2lkdGg9JzYwMCcgaGVpZ2h0PSc0MDAnIGZpbGw9JyNkNGM1YjAnLz48bGluZSB4MT0nMTAwJyB5MT0nNjAnIHgyPScxMDAnIHkyPSczODAnIHN0cm9rZT0nIzZiNWE0NScgc3Ryb2tlLXdpZHRoPScyJyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nMjAwJyB5MT0nNjAnIHgyPScyMDAnIHkyPSczODAnIHN0cm9rZT0nIzZiNWE0NScgc3Ryb2tlLXdpZHRoPScyJyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nMzAwJyB5MT0nNjAnIHgyPSczMDAnIHkyPSczODAnIHN0cm9rZT0nIzZiNWE0NScgc3Ryb2tlLXdpZHRoPScyJyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nNDAwJyB5MT0nNjAnIHgyPSc0MDAnIHkyPSczODAnIHN0cm9rZT0nIzZiNWE0NScgc3Ryb2tlLXdpZHRoPScyJyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nNTAwJyB5MT0nNjAnIHgyPSc1MDAnIHkyPSczODAnIHN0cm9rZT0nIzZiNWE0NScgc3Ryb2tlLXdpZHRoPScyJyBvcGFjaXR5PScwLjMnLz48cGF0aCBkPSdNODUgNjAgUTEwMCA1NSAxMTUgNjAgTDExNSAzODAgUTEwMCAzODUgODUgMzgwWicgZmlsbD0nIzhiNmU1MCcgb3BhY2l0eT0nMC4xNScvPjxwYXRoIGQ9J00xODUgNjAgUTIwMCA1NSAyMTUgNjAgTDIxNSAzODAgUTIwMCAzODUgMTg1IDM4MFonIGZpbGw9JyM3YTVhM2EnIG9wYWNpdHk9JzAuMTInLz48cGF0aCBkPSdNMjg1IDYwIFEzMDAgNTUgMzE1IDYwIEwzMTUgMzgwIFEzMDAgMzg1IDI4NSAzODBaJyBmaWxsPScjOWU4MDYwJyBvcGFjaXR5PScwLjE1Jy8+PHBhdGggZD0nTTM4NSA2MCBRNDAwIDU1IDQxNSA2MCBMNDE1IDM4MCBRNDAwIDM4NSAzODUgMzgwWicgZmlsbD0nIzZiNTA0MCcgb3BhY2l0eT0nMC4xMicvPjxwYXRoIGQ9J000ODUgNjAgUTUwMCA1NSA1MTUgNjAgTDUxNSAzODAgUTUwMCAzODUgNDg1IDM4MFonIGZpbGw9JyM4YjZlNTAnIG9wYWNpdHk9JzAuMTUnLz48bGluZSB4MT0nMCcgeTE9JzYwJyB4Mj0nNjAwJyB5Mj0nNjAnIHN0cm9rZT0nIzZiNWE0NScgc3Ryb2tlLXdpZHRoPScxLjUnIG9wYWNpdHk9JzAuMzUnLz48L3N2Zz4=",
  writing:    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2MDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjAwIDQwMCc+PHJlY3Qgd2lkdGg9JzYwMCcgaGVpZ2h0PSc0MDAnIGZpbGw9JyNmMGViZTAnLz48bGluZSB4MT0nODAnIHkxPScxMDAnIHgyPSc1MjAnIHkyPScxMDAnIHN0cm9rZT0nIzhhN2E2MCcgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nODAnIHkxPScxMzAnIHgyPSc1MjAnIHkyPScxMzAnIHN0cm9rZT0nIzhhN2E2MCcgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nODAnIHkxPScxNjAnIHgyPSc1MjAnIHkyPScxNjAnIHN0cm9rZT0nIzhhN2E2MCcgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nODAnIHkxPScxOTAnIHgyPSc1MjAnIHkyPScxOTAnIHN0cm9rZT0nIzhhN2E2MCcgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nODAnIHkxPScyMjAnIHgyPSc1MjAnIHkyPScyMjAnIHN0cm9rZT0nIzhhN2E2MCcgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nODAnIHkxPScyNTAnIHgyPSc1MjAnIHkyPScyNTAnIHN0cm9rZT0nIzhhN2E2MCcgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nODAnIHkxPScyODAnIHgyPSc1MjAnIHkyPScyODAnIHN0cm9rZT0nIzhhN2E2MCcgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nODAnIHkxPSczMTAnIHgyPSc1MjAnIHkyPSczMTAnIHN0cm9rZT0nIzhhN2E2MCcgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nMTQwJyB5MT0nNjAnIHgyPScxNDAnIHkyPSczODAnIHN0cm9rZT0nI2MwNDgzYScgc3Ryb2tlLXdpZHRoPScxJyBvcGFjaXR5PScwLjInLz48cGF0aCBkPSdNMTYwIDEwMCBRMjAwIDk1IDI0MCAxMDAgUTI4MCAxMDUgMzIwIDEwMCcgZmlsbD0nbm9uZScgc3Ryb2tlPScjM2EzMDI4JyBzdHJva2Utd2lkdGg9JzEuNScgb3BhY2l0eT0nMC4yNScvPjxwYXRoIGQ9J00xNjAgMTMwIFEyMjAgMTI1IDI4MCAxMzAgUTM0MCAxMzUgNDAwIDEyOCcgZmlsbD0nbm9uZScgc3Ryb2tlPScjM2EzMDI4JyBzdHJva2Utd2lkdGg9JzEuNScgb3BhY2l0eT0nMC4yJy8+PHBhdGggZD0nTTE2MCAxNjAgUTI1MCAxNTUgMzYwIDE2MicgZmlsbD0nbm9uZScgc3Ryb2tlPScjM2EzMDI4JyBzdHJva2Utd2lkdGg9JzEuNScgb3BhY2l0eT0nMC4yJy8+PHBhdGggZD0nTTQ0MCAyOTAgTDQ2MCAyNDAgTDQ4MCAyOTAnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzNhMzAyOCcgc3Ryb2tlLXdpZHRoPScxLjUnIG9wYWNpdHk9JzAuMycvPjxsaW5lIHgxPSc0NTAnIHkxPScyOTAnIHgyPSc0ODAnIHkyPSczNDAnIHN0cm9rZT0nIzNhMzAyOCcgc3Ryb2tlLXdpZHRoPScxJyBvcGFjaXR5PScwLjI1Jy8+PC9zdmc+",
  design:     "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2MDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjAwIDQwMCc+PHJlY3Qgd2lkdGg9JzYwMCcgaGVpZ2h0PSc0MDAnIGZpbGw9JyNmNWYwZTgnLz48cmVjdCB4PSc2MCcgeT0nNjAnIHdpZHRoPSc0ODAnIGhlaWdodD0nMzAwJyByeD0nNCcgZmlsbD0nbm9uZScgc3Ryb2tlPScjNGE0MDM1JyBzdHJva2Utd2lkdGg9JzEnIG9wYWNpdHk9JzAuMicvPjxyZWN0IHg9JzYwJyB5PSc2MCcgd2lkdGg9JzQ4MCcgaGVpZ2h0PScyOCcgZmlsbD0nIzRhNDAzNScgb3BhY2l0eT0nMC4wOCcvPjxjaXJjbGUgY3g9JzgwJyBjeT0nNzQnIHI9JzUnIGZpbGw9JyNjMDQwNDAnIG9wYWNpdHk9JzAuMycvPjxjaXJjbGUgY3g9Jzk2JyBjeT0nNzQnIHI9JzUnIGZpbGw9JyNjMGEwNDAnIG9wYWNpdHk9JzAuMycvPjxjaXJjbGUgY3g9JzExMicgY3k9Jzc0JyByPSc1JyBmaWxsPScjNDBhMDQwJyBvcGFjaXR5PScwLjMnLz48cmVjdCB4PSc4MCcgeT0nMTEwJyB3aWR0aD0nMTQwJyBoZWlnaHQ9JzIyMCcgZmlsbD0nIzRhNDAzNScgb3BhY2l0eT0nMC4wNycvPjxyZWN0IHg9JzI0MCcgeT0nMTEwJyB3aWR0aD0nMjgwJyBoZWlnaHQ9JzEwMCcgZmlsbD0nIzRhNDAzNScgb3BhY2l0eT0nMC4wNicvPjxyZWN0IHg9JzI0MCcgeT0nMjIwJyB3aWR0aD0nMTM1JyBoZWlnaHQ9JzExMCcgZmlsbD0nIzRhNDAzNScgb3BhY2l0eT0nMC4wNicvPjxyZWN0IHg9JzM4NScgeT0nMjIwJyB3aWR0aD0nMTM1JyBoZWlnaHQ9JzExMCcgZmlsbD0nIzRhNDAzNScgb3BhY2l0eT0nMC4wNicvPjxsaW5lIHgxPSc4MCcgeTE9JzE1MCcgeDI9JzIwMCcgeTI9JzE1MCcgc3Ryb2tlPScjNGE0MDM1JyBzdHJva2Utd2lkdGg9JzYnIG9wYWNpdHk9JzAuMScvPjxsaW5lIHgxPSc4MCcgeTE9JzE2NScgeDI9JzE4NScgeTI9JzE2NScgc3Ryb2tlPScjNGE0MDM1JyBzdHJva2Utd2lkdGg9JzQnIG9wYWNpdHk9JzAuMDgnLz48bGluZSB4MT0nODAnIHkxPScxNzgnIHgyPScxOTUnIHkyPScxNzgnIHN0cm9rZT0nIzRhNDAzNScgc3Ryb2tlLXdpZHRoPSc0JyBvcGFjaXR5PScwLjA4Jy8+PGNpcmNsZSBjeD0nMzQwJyBjeT0nMTYwJyByPSczMCcgZmlsbD0nbm9uZScgc3Ryb2tlPScjNGE0MDM1JyBzdHJva2Utd2lkdGg9JzEnIG9wYWNpdHk9JzAuMTUnLz48L3N2Zz4=",
  music:      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2MDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjAwIDQwMCc+PHJlY3Qgd2lkdGg9JzYwMCcgaGVpZ2h0PSc0MDAnIGZpbGw9JyMxODE0MWUnLz48ZWxsaXBzZSBjeD0nMzAwJyBjeT0nMzgwJyByeD0nMzUwJyByeT0nMTIwJyBmaWxsPScjNjAzMGEwJyBvcGFjaXR5PScwLjE1Jy8+PGVsbGlwc2UgY3g9JzMwMCcgY3k9JzM4MCcgcng9JzIwMCcgcnk9JzgwJyBmaWxsPScjODA0MGMwJyBvcGFjaXR5PScwLjEyJy8+PGxpbmUgeDE9JzYwJyB5MT0nMzAwJyB4Mj0nNjAnIHkyPScxNTAnIHN0cm9rZT0nI2MwYTBlMCcgc3Ryb2tlLXdpZHRoPSczJyBvcGFjaXR5PScwLjInLz48bGluZSB4MT0nMTIwJyB5MT0nMzAwJyB4Mj0nMTIwJyB5Mj0nMTAwJyBzdHJva2U9JyNjMGEwZTAnIHN0cm9rZS13aWR0aD0nMycgb3BhY2l0eT0nMC4yJy8+PGxpbmUgeDE9JzE4MCcgeTE9JzMwMCcgeDI9JzE4MCcgeTI9JzE4MCcgc3Ryb2tlPScjYzBhMGUwJyBzdHJva2Utd2lkdGg9JzMnIG9wYWNpdHk9JzAuMicvPjxsaW5lIHgxPScyNDAnIHkxPSczMDAnIHgyPScyNDAnIHkyPSc4MCcgc3Ryb2tlPScjYzBhMGUwJyBzdHJva2Utd2lkdGg9JzMnIG9wYWNpdHk9JzAuMjUnLz48bGluZSB4MT0nMzAwJyB5MT0nMzAwJyB4Mj0nMzAwJyB5Mj0nNjAnIHN0cm9rZT0nI2UwYzBmZicgc3Ryb2tlLXdpZHRoPSc0JyBvcGFjaXR5PScwLjMnLz48bGluZSB4MT0nMzYwJyB5MT0nMzAwJyB4Mj0nMzYwJyB5Mj0nOTAnIHN0cm9rZT0nI2MwYTBlMCcgc3Ryb2tlLXdpZHRoPSczJyBvcGFjaXR5PScwLjI1Jy8+PGxpbmUgeDE9JzQyMCcgeTE9JzMwMCcgeDI9JzQyMCcgeTI9JzE0MCcgc3Ryb2tlPScjYzBhMGUwJyBzdHJva2Utd2lkdGg9JzMnIG9wYWNpdHk9JzAuMicvPjxsaW5lIHgxPSc0ODAnIHkxPSczMDAnIHgyPSc0ODAnIHkyPScxMTAnIHN0cm9rZT0nI2MwYTBlMCcgc3Ryb2tlLXdpZHRoPSczJyBvcGFjaXR5PScwLjInLz48bGluZSB4MT0nNTQwJyB5MT0nMzAwJyB4Mj0nNTQwJyB5Mj0nMjAwJyBzdHJva2U9JyNjMGEwZTAnIHN0cm9rZS13aWR0aD0nMycgb3BhY2l0eT0nMC4yJy8+PGNpcmNsZSBjeD0nMzAwJyBjeT0nMjAwJyByPScxMjAnIGZpbGw9J25vbmUnIHN0cm9rZT0nI2MwYTBlMCcgc3Ryb2tlLXdpZHRoPScwLjc1JyBvcGFjaXR5PScwLjEnLz48Y2lyY2xlIGN4PSczMDAnIGN5PScyMDAnIHI9JzYwJyBmaWxsPSdub25lJyBzdHJva2U9JyNjMGEwZTAnIHN0cm9rZS13aWR0aD0nMC43NScgb3BhY2l0eT0nMC4xJy8+PC9zdmc+",
  floral:     "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2MDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjAwIDQwMCc+PHJlY3Qgd2lkdGg9JzYwMCcgaGVpZ2h0PSc0MDAnIGZpbGw9JyNlOGYwZTAnLz48Y2lyY2xlIGN4PSczMDAnIGN5PScxODAnIHI9JzM1JyBmaWxsPScjZjBjMGEwJyBvcGFjaXR5PScwLjQnLz48ZWxsaXBzZSBjeD0nMzAwJyBjeT0nMTMwJyByeD0nMjInIHJ5PSczOCcgZmlsbD0nI2Y4ZDBiOCcgb3BhY2l0eT0nMC4zNScgdHJhbnNmb3JtPSdyb3RhdGUoMCAzMDAgMTgwKScvPjxlbGxpcHNlIGN4PSczMDAnIGN5PScxMzAnIHJ4PScyMicgcnk9JzM4JyBmaWxsPScjZjhiOGMwJyBvcGFjaXR5PScwLjM1JyB0cmFuc2Zvcm09J3JvdGF0ZSg0NSAzMDAgMTgwKScvPjxlbGxpcHNlIGN4PSczMDAnIGN5PScxMzAnIHJ4PScyMicgcnk9JzM4JyBmaWxsPScjZjhkMGI4JyBvcGFjaXR5PScwLjM1JyB0cmFuc2Zvcm09J3JvdGF0ZSg5MCAzMDAgMTgwKScvPjxlbGxpcHNlIGN4PSczMDAnIGN5PScxMzAnIHJ4PScyMicgcnk9JzM4JyBmaWxsPScjZjhiOGMwJyBvcGFjaXR5PScwLjM1JyB0cmFuc2Zvcm09J3JvdGF0ZSgxMzUgMzAwIDE4MCknLz48ZWxsaXBzZSBjeD0nMzAwJyBjeT0nMTMwJyByeD0nMjInIHJ5PSczOCcgZmlsbD0nI2Y4ZDBiOCcgb3BhY2l0eT0nMC4zNScgdHJhbnNmb3JtPSdyb3RhdGUoMTgwIDMwMCAxODApJy8+PGVsbGlwc2UgY3g9JzMwMCcgY3k9JzEzMCcgcng9JzIyJyByeT0nMzgnIGZpbGw9JyNmOGI4YzAnIG9wYWNpdHk9JzAuMzUnIHRyYW5zZm9ybT0ncm90YXRlKDIyNSAzMDAgMTgwKScvPjxlbGxpcHNlIGN4PSczMDAnIGN5PScxMzAnIHJ4PScyMicgcnk9JzM4JyBmaWxsPScjZjhkMGI4JyBvcGFjaXR5PScwLjM1JyB0cmFuc2Zvcm09J3JvdGF0ZSgyNzAgMzAwIDE4MCknLz48ZWxsaXBzZSBjeD0nMzAwJyBjeT0nMTMwJyByeD0nMjInIHJ5PSczOCcgZmlsbD0nI2Y4YjhjMCcgb3BhY2l0eT0nMC4zNScgdHJhbnNmb3JtPSdyb3RhdGUoMzE1IDMwMCAxODApJy8+PHBhdGggZD0nTTMwMCAyMTUgUTI5MCAyODAgMjcwIDM0MCcgZmlsbD0nbm9uZScgc3Ryb2tlPScjNWE4MDQwJyBzdHJva2Utd2lkdGg9JzInIG9wYWNpdHk9JzAuNCcvPjxwYXRoIGQ9J00yODUgMjYwIFEyNjAgMjUwIDI0NSAyNjUnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzVhODA0MCcgc3Ryb2tlLXdpZHRoPScxLjUnIG9wYWNpdHk9JzAuMzUnLz48Y2lyY2xlIGN4PScxMjAnIGN5PSczMDAnIHI9JzIwJyBmaWxsPScjZjhjMGQwJyBvcGFjaXR5PScwLjI1Jy8+PGNpcmNsZSBjeD0nNDgwJyBjeT0nMTAwJyByPScxNScgZmlsbD0nI2Y4ZDhhMCcgb3BhY2l0eT0nMC4yNScvPjxjaXJjbGUgY3g9JzE1MCcgY3k9JzEyMCcgcj0nMTInIGZpbGw9JyNkMGU4YjAnIG9wYWNpdHk9JzAuMycvPjxjaXJjbGUgY3g9JzQ1MCcgY3k9JzMyMCcgcj0nMTgnIGZpbGw9JyNmOGMwYTgnIG9wYWNpdHk9JzAuMjUnLz48L3N2Zz4=",
  smallbatch: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2MDAnIGhlaWdodD0nNDAwJyB2aWV3Qm94PScwIDAgNjAwIDQwMCc+PHJlY3Qgd2lkdGg9JzYwMCcgaGVpZ2h0PSc0MDAnIGZpbGw9JyNlOGUwZDAnLz48cmVjdCB4PScyMDAnIHk9JzE0MCcgd2lkdGg9JzgwJyBoZWlnaHQ9JzE4MCcgcng9JzYnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzVhNGUzYScgc3Ryb2tlLXdpZHRoPScxLjUnIG9wYWNpdHk9JzAuMzUnLz48ZWxsaXBzZSBjeD0nMjQwJyBjeT0nMTQwJyByeD0nNDAnIHJ5PScxMicgZmlsbD0nbm9uZScgc3Ryb2tlPScjNWE0ZTNhJyBzdHJva2Utd2lkdGg9JzEuNScgb3BhY2l0eT0nMC4zNScvPjxlbGxpcHNlIGN4PScyNDAnIGN5PScxNDAnIHJ4PSc0MCcgcnk9JzEyJyBmaWxsPScjNWE0ZTNhJyBvcGFjaXR5PScwLjA4Jy8+PHJlY3QgeD0nMjEwJyB5PScxNzUnIHdpZHRoPSc2MCcgaGVpZ2h0PSc2MCcgZmlsbD0nIzVhNGUzYScgb3BhY2l0eT0nMC4wNycvPjxsaW5lIHgxPScyMTAnIHkxPScxODUnIHgyPScyNzAnIHkyPScxODUnIHN0cm9rZT0nIzVhNGUzYScgc3Ryb2tlLXdpZHRoPSczJyBvcGFjaXR5PScwLjEnLz48bGluZSB4MT0nMjEwJyB5MT0nMTk1JyB4Mj0nMjY1JyB5Mj0nMTk1JyBzdHJva2U9JyM1YTRlM2EnIHN0cm9rZS13aWR0aD0nMycgb3BhY2l0eT0nMC4wOCcvPjxyZWN0IHg9JzMyMCcgeT0nMTYwJyB3aWR0aD0nNzAnIGhlaWdodD0nMTYwJyByeD0nNicgZmlsbD0nbm9uZScgc3Ryb2tlPScjNWE0ZTNhJyBzdHJva2Utd2lkdGg9JzEuNScgb3BhY2l0eT0nMC4zJy8+PGVsbGlwc2UgY3g9JzM1NScgY3k9JzE2MCcgcng9JzM1JyByeT0nMTAnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzVhNGUzYScgc3Ryb2tlLXdpZHRoPScxLjUnIG9wYWNpdHk9JzAuMycvPjxyZWN0IHg9JzE0MCcgeT0nMjAwJyB3aWR0aD0nNTAnIGhlaWdodD0nMTIwJyByeD0nNCcgZmlsbD0nbm9uZScgc3Ryb2tlPScjNWE0ZTNhJyBzdHJva2Utd2lkdGg9JzEnIG9wYWNpdHk9JzAuMicvPjxlbGxpcHNlIGN4PScxNjUnIGN5PScyMDAnIHJ4PScyNScgcnk9JzgnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzVhNGUzYScgc3Ryb2tlLXdpZHRoPScxJyBvcGFjaXR5PScwLjInLz48bGluZSB4MT0nMTAwJyB5MT0nMzIwJyB4Mj0nNTAwJyB5Mj0nMzIwJyBzdHJva2U9JyM1YTRlM2EnIHN0cm9rZS13aWR0aD0nMScgb3BhY2l0eT0nMC4yJy8+PHJlY3QgeD0nNDIwJyB5PScyMTAnIHdpZHRoPSc0NScgaGVpZ2h0PScxMTAnIHJ4PSc0JyBmaWxsPSdub25lJyBzdHJva2U9JyM1YTRlM2EnIHN0cm9rZS13aWR0aD0nMScgb3BhY2l0eT0nMC4yJy8+PC9zdmc+",
}

const NICHES = [
  { key: 'ceramic',    name: 'Ceramic workshops',       example: '8 seats, gone in 4 minutes' },
  { key: 'tattoo',     name: 'Tattoo flash drops',      example: '12 designs, first come first served' },
  { key: 'print',      name: 'Limited print releases',  example: 'Edition of 50, numbered' },
  { key: 'photo',      name: 'Photography sessions',    example: 'Spring portrait slots opening' },
  { key: 'vintage',    name: 'Vintage clothing drops',  example: '60-piece haul, Sunday at noon' },
  { key: 'writing',    name: 'Writing cohorts',         example: '12 writers, 6 weeks, 1 opening' },
  { key: 'design',     name: 'Design masterclasses',    example: 'Live session, limited attendance' },
  { key: 'music',      name: 'Music listening sessions', example: 'Album premiere, RSVP only' },
  { key: 'floral',     name: 'Floral workshops',        example: 'Seasonal arrangement class' },
  { key: 'smallbatch', name: 'Small-batch products',    example: 'Batch 003 — 40 units only' },
]

const COLLECT_MODES = [
  { tier: 'Free',              name: 'Waitlist',     desc: 'Build anticipation before you open. Collect interest with zero friction — no payment required, just an email and intent.',                                              eg: '→ Ceramic workshops, cohorts, flash drops' },
  { tier: 'Paid · via Stripe', name: 'Pre-order',    desc: "Sell before you ship. Customers pay in full now for something that isn't available yet — charged at the moment the drop opens.",                                     eg: '→ Limited prints, small-batch products' },
  { tier: 'Held · via Stripe', name: 'Reservation',  desc: 'Hold a spot without charging yet. Stripe authorises the card at sign-up; the charge only goes through when the drop opens.',                                        eg: '→ Fashion drops, vintage, tattoo slots' },
  { tier: 'Partial · via Stripe', name: 'Deposit',   desc: 'Secure a spot with a partial payment. Lower the barrier to commit while guaranteeing serious interest — balance due at pickup or delivery.',                       eg: '→ Workshops, commissions, sessions' },
]

const PLANS = [
  { name: 'Studio',  price: 'Free', note: 'For your first drop.',      period: 'Always, no credit card',    features: ['1 active drop', 'Waitlist collection', 'Countdown page', 'Dropvine watermark'],                     href: '/signup',              cta: 'Start for free', featured: false },
  { name: 'Maker',   price: '$10',  note: 'For serious independents.', period: 'per month, cancel anytime', features: ['3 active drops', 'Pre-orders, reservations & deposits', 'Countdown page', 'No watermark'],           href: '/signup?plan=maker',   cta: 'Get Maker',      featured: false },
  { name: 'Atelier', price: '$24',  note: 'For ongoing makers.',       period: 'per month, cancel anytime', features: ['Unlimited drops', 'Pre-orders, reservations & deposits', 'Custom domain', 'No watermark'],           href: '/signup?plan=atelier', cta: 'Get Atelier',    featured: true  },
]

const TICKER_ITEMS = [
  'Ceramic workshops', 'Tattoo flash drops', 'Limited print releases',
  'Photography sessions', 'Vintage clothing drops', 'Writing cohorts',
  'Design masterclasses', 'Music listening sessions', 'Floral workshops', 'Small-batch product launches',
]

export default function LandingPage() {
  const target = useMemo(() => new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(), [])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      {/* HERO */}
      <section className="relative pt-36 md:pt-44 pb-24 md:pb-40 overflow-hidden">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-10 animate-fade-in">
                <span className="h-px w-8 bg-foreground/30" />
                <span>The anticipation engine — Edition 01</span>
              </div>
              <h1 className="font-serif font-light text-[44px] sm:text-6xl md:text-7xl leading-[0.96] tracking-tightest text-balance animate-fade-up">
                Your next drop
                <br />
                <span className="italic font-extralight">deserves a moment.</span>
              </h1>
              <p className="mt-10 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed text-pretty animate-fade-up" style={{ animationDelay: '120ms' }}>
                Build a timed page, collect waitlists, pre-orders, reservations, or deposits — then open the doors at exactly the right second.
              </p>
              <p className="mt-3 font-serif italic text-foreground/60 text-base animate-fade-up" style={{ animationDelay: '160ms' }}>
                Used for drops, workshops, and limited releases.
              </p>
              <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-5 animate-fade-up" style={{ animationDelay: '220ms' }}>
                <Link href="/signup" className="group inline-flex items-center gap-3 bg-foreground text-background px-7 py-4 text-sm hover:opacity-90 transition">
                  Build your drop page
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="#example" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
                  See it in action <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Demo drop cards */}
            <div className="flex flex-col gap-3">
              {/* Clay Collective — featured live card */}
              <div className="relative overflow-hidden p-8 text-white" style={{ background: '#7d726a' }}>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-white/40 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Live right now
                </div>
                <div className="font-serif text-2xl font-light tracking-tight mb-1">The Clay Collective</div>
                <div className="text-sm text-white/50 mb-6">Workshop — 8 seats remaining</div>
                {mounted && (
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[['02','hrs'],['47','min'],['33','sec'],['8','seats']].map(([n, l]) => (
                      <div key={l} className="text-center">
                        <div className="font-serif text-3xl font-light tracking-tighter">{n}</div>
                        <div className="text-[9px] uppercase tracking-[0.12em] text-white/30 mt-1">{l}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs text-white/40">
                  <span>246 on waitlist</span>
                  <span className="border border-white/20 px-3 py-1 text-white/60 font-mono tracking-wide text-[10px]">RESERVE SPOT</span>
                </div>
              </div>

              {/* Flash Tattoo Drop */}
              <div className="flex items-center justify-between px-5 py-4 text-white" style={{ background: '#2a2420' }}>
                <div>
                  <div className="text-sm font-medium text-white/90">Flash Tattoo Drop — June</div>
                  <div className="text-[11px] text-white/40 uppercase tracking-wider mt-0.5">Flash Drop</div>
                </div>
                <span className="text-[10px] font-mono tracking-wide px-2.5 py-1 bg-yellow-900/40 text-yellow-300">Opens in 3d</span>
              </div>

              {/* Batch 004 */}
              <div className="flex items-center justify-between px-5 py-4 text-white" style={{ background: '#8b2218' }}>
                <div>
                  <div className="text-sm font-medium text-white/90">Batch 004</div>
                  <div className="text-[11px] text-white/40 uppercase tracking-wider mt-0.5">Small-batch</div>
                </div>
                <span className="text-[10px] font-mono tracking-wide px-2.5 py-1 bg-green-900/40 text-green-300">Live now</span>
              </div>
            </div>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border" />
      </section>

      {/* COUNTDOWN STRIP */}
      <section className="border-y border-border bg-secondary/40">
        <div className="container py-14 md:py-20">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Live demonstration</div>
              <h2 className="font-serif font-light text-3xl md:text-5xl leading-tight tracking-tighter">
                The next drop opens in
              </h2>
            </div>
            {mounted ? <Countdown target={target} size="lg" /> : <div className="h-24" />}
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div className="border-b border-border bg-foreground text-background overflow-hidden py-4">
        <div className="flex gap-12 animate-ticker whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="font-serif italic text-sm opacity-60 shrink-0">
              {item}
              <span className="ml-12 inline-block w-1 h-1 rounded-full bg-current opacity-40 align-middle" />
            </span>
          ))}
        </div>
      </div>

      {/* FOUR WAYS TO COLLECT */}
      <section id="collect" className="container py-24 md:py-40">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Four ways to collect</div>
        <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter text-balance mb-4">
          Choose how your audience commits <span className="italic">before the doors open.</span>
        </h2>
        <p className="text-muted-foreground leading-relaxed max-w-xl mb-16">
          Every drop is different. Dropvine gives you the right collection mode for the moment — from a free spot on a list to a paid deposit that holds a place.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 border border-border">
          {COLLECT_MODES.map((m, i) => (
            <div key={m.name} className={`p-8 border-border ${i < 3 ? 'border-r' : ''} ${i % 2 === 1 ? 'bg-secondary/40' : ''}`}>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">{m.tier}</div>
              <div className="font-serif text-2xl tracking-tight mb-3">{m.name}</div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{m.desc}</p>
              <p className="text-[11px] text-muted-foreground/60 font-mono tracking-wide">{m.eg}</p>
            </div>
          ))}
        </div>
      </section>

      {/* USED BY CREATORS */}
      <section id="creators" className="border-t border-border bg-secondary/40">
        <div className="container py-24 md:py-40">
          <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Used by creators dropping…</div>
          <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter text-balance mb-4">
            Wherever there's <span className="italic">limited work</span> and a waiting audience.
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-xl mb-16">
            Dropvine is the anticipation engine for creators who release in moments, not catalogs. One page, one window, one drop.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border border-border">
            {NICHES.map((n) => (
              <div
                key={n.key}
                className="relative border-r border-b border-border overflow-hidden min-h-[160px] flex flex-col justify-end group"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-20 transition-opacity duration-300 group-hover:opacity-30"
                  style={{ backgroundImage: `url('${NICHE_SVG[n.key]}')` }}
                />
                <div className="relative p-5">
                  <div className="font-serif text-base tracking-tight mb-0.5">{n.name}</div>
                  <div className="text-[12px] text-muted-foreground italic">{n.example}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="container py-24 md:py-40">
        <div className="grid md:grid-cols-12 gap-12 md:gap-16">
          <div className="md:col-span-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">The method</div>
            <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter text-balance">
              Three steps. <span className="italic">Nothing more.</span>
            </h2>
            <p className="mt-6 text-sm text-muted-foreground leading-relaxed">Set up in an afternoon. Release on your own clock.</p>
          </div>
          <div className="md:col-span-8 grid sm:grid-cols-3 gap-10 md:gap-14">
            {[
              { n: '01', t: 'Compose', d: 'Write your story. Upload imagery. Set the exact moment your page opens to the world.' },
              { n: '02', t: 'Gather',  d: 'Collect a free waitlist, take pre-orders, hold reservations, or require a deposit — your audience shows up committed, not just curious.' },
              { n: '03', t: 'Release', d: 'When the timer hits zero, the page opens. Commerce starts. The moment lands.' },
            ].map(s => (
              <div key={s.n}>
                <div className="font-serif italic text-muted-foreground text-sm mb-6">{s.n}</div>
                <div className="font-serif text-2xl mb-3 tracking-tight">{s.t}</div>
                <p className="text-muted-foreground leading-relaxed text-[15px]">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXAMPLE DROP */}
      <section id="example" className="border-t border-border bg-stone-100/60">
        <div className="container py-24 md:py-40">
          <div className="grid md:grid-cols-12 gap-12">
            <div className="md:col-span-5">
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">An example</div>
              <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter">
                Maison Noir
                <br /><span className="italic">Fall / Winter '26</span>
              </h2>
              <p className="mt-6 text-muted-foreground leading-relaxed max-w-md">
                A 12-piece capsule, limited to 200. Reservations hold a size for 24 hours after release. Page opens at the moment shown.
              </p>
              <Link href="/l/maison-noir-fw26" className="mt-8 inline-flex items-center gap-2 text-sm border-b border-foreground pb-1 hover:opacity-70">
                View the drop page <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <div className="mt-12 grid grid-cols-2 gap-4">
                {[
                  { n: '847', l: 'people on the waitlist' },
                  { n: '11m', l: 'to sell out the collection' },
                  { n: '200', l: 'units — all reserved' },
                  { n: '0',   l: 'support emails afterward' },
                ].map(s => (
                  <div key={s.l} className="border border-border p-4">
                    <div className="font-serif text-3xl tracking-tighter">{s.n}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-7">
              <div className="aspect-[4/5] md:aspect-[5/6] bg-gradient-to-b from-stone-200 to-stone-300 relative overflow-hidden">
                <div className="absolute inset-0 grain opacity-60" />
                <div className="absolute inset-0 flex items-end p-8 md:p-12">
                  <div className="text-stone-900">
                    <div className="text-[11px] uppercase tracking-[0.25em] mb-3">Opens in</div>
                    {mounted && <Countdown target={target} size="md" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="container py-24 md:py-40">
        <div className="grid md:grid-cols-12 gap-10 md:gap-16">
          <div className="md:col-span-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Pricing</div>
            <h2 className="font-serif font-light text-4xl md:text-5xl leading-tight tracking-tighter">
              Honest. <span className="italic">Pay when it ships.</span>
            </h2>
            <p className="mt-6 text-sm text-muted-foreground leading-relaxed">Start free. Upgrade when you need more. No lock-in.</p>
          </div>
          <div className="md:col-span-8 grid sm:grid-cols-3 gap-6">
            {PLANS.map(p => (
              <div key={p.name} className={`border p-8 md:p-10 transition-colors flex flex-col ${p.featured ? 'bg-foreground text-background border-foreground' : 'bg-background border-border hover:border-foreground'}`}>
                <div className={`text-[10px] uppercase tracking-[0.2em] mb-6 ${p.featured ? 'text-background/50' : 'text-muted-foreground'}`}>{p.name}</div>
                <div className={`font-serif text-xl tracking-tight ${p.featured ? 'text-background' : ''}`}>{p.name}</div>
                <div className={`text-sm mt-1 mb-8 ${p.featured ? 'text-background/50' : 'text-muted-foreground'}`}>{p.note}</div>
                <div className={`font-serif text-5xl font-light tracking-tighter ${p.featured ? 'text-background' : ''}`}>{p.price}</div>
                <div className={`text-xs mt-1 mb-8 ${p.featured ? 'text-background/40' : 'text-muted-foreground'}`}>{p.period}</div>
                <ul className="space-y-3 text-sm flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-3">
                      <span className={`mt-1.5 inline-block h-px w-4 shrink-0 ${p.featured ? 'bg-background/30' : 'bg-foreground/40'}`} />
                      <span className={p.featured ? 'text-background/75' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className={`mt-10 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm transition ${p.featured ? 'bg-background text-foreground hover:opacity-90' : 'border border-border hover:border-foreground'}`}>
                  {p.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-foreground text-background">
        <div className="container py-24 md:py-40 text-center">
          <div className="text-[11px] uppercase tracking-[0.25em] text-background/40 mb-8">Ready when you are</div>
          <h2 className="font-serif font-light text-4xl md:text-7xl leading-[1.02] tracking-tightest max-w-3xl mx-auto text-balance">
            <span className="italic">Compose</span> the moment your work arrives in the world.
          </h2>
          <p className="mt-6 text-background/50 max-w-sm mx-auto text-sm leading-relaxed">
            Your next drop deserves a page as considered as the thing itself.
          </p>
          <Link href="/signup" className="mt-12 inline-flex items-center gap-3 bg-background text-foreground px-8 py-4 text-sm hover:opacity-90">
            Begin your drop <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}

import AdminShell from '@/components/markets/AdminShell'
import { MapPin } from 'lucide-react'

export default function AdminAmenitiesPage() {
  return (
    <AdminShell>
      <ComingSoon
        icon={MapPin}
        title="Amenities"
        body="Manage non-vendor map pins — Parking, Restrooms, Info Booth, First Aid, ATM, etc. Backed by the existing market_amenities table. Drag pins onto the street map, set icons and labels, toggle visibility per market_date, and preview how the overlay appears to shoppers in the PWA."
      />
    </AdminShell>
  )
}
function ComingSoon({ icon: Icon, title, body }) {
  return (
    <div className="max-w-2xl mx-auto py-16 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 mb-5"><Icon className="w-5 h-5 text-stone-500" /></div>
      <h1 className="font-serif text-3xl text-stone-900 mb-3">{title}</h1>
      <div className="text-[10px] uppercase tracking-[0.25em] text-stone-400 mb-5">Coming soon</div>
      <p className="text-sm text-stone-600 leading-relaxed max-w-lg mx-auto">{body}</p>
    </div>
  )
}

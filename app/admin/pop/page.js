import AdminShell from '@/components/markets/AdminShell'
import { BadgeCheck } from 'lucide-react'

export default function AdminPopPage() {
  return (
    <AdminShell>
      <ComingSoon
        icon={BadgeCheck}
        title="POP Passport"
        body="Administer the kids’ POP programme — manage stamp types and their token rewards, view redemption activity across vendors, and see which children have earned which rewards. Backed by the existing pop_tokens, pop_stamp_types, and pop_redemptions tables. Includes a leaderboard view and per-child detail page."
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

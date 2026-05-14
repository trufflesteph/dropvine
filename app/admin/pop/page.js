import AdminShell from '@/components/markets/AdminShell'
import { BadgeCheck } from 'lucide-react'

export default function AdminPopPage() {
  return (
    <AdminShell>
      <ComingSoon
        icon={BadgeCheck}
        title="POP Passport"
        body="Manage Power of Produce stamp types, view token issuance and redemption activity, and see which children have earned rewards this season."
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

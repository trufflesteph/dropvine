// Stub admin page — functionality to be built.
import AdminShell from '@/components/markets/AdminShell'
import { ClipboardList } from 'lucide-react'

export default function AdminAttendancePage() {
  return (
    <AdminShell>
      <ComingSoon
        icon={ClipboardList}
        title="Attendance"
        body="Weekly check-in workflow for confirming which vendors are attending each market date and assigning booth numbers. Lists upcoming market_dates, with a vendor roster you can toggle attendance for, drag-and-drop booth assignment onto the street map, and a one-click 'lock day' action that freezes assignments and updates the public map."
      />
    </AdminShell>
  )
}

function ComingSoon({ icon: Icon, title, body }) {
  return (
    <div className="max-w-2xl mx-auto py-16 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 mb-5">
        <Icon className="w-5 h-5 text-stone-500" />
      </div>
      <h1 className="font-serif text-3xl text-stone-900 mb-3">{title}</h1>
      <div className="text-[10px] uppercase tracking-[0.25em] text-stone-400 mb-5">Coming soon</div>
      <p className="text-sm text-stone-600 leading-relaxed max-w-lg mx-auto">{body}</p>
    </div>
  )
}

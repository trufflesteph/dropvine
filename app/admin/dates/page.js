// Redirect legacy /admin/dates → /admin/market-dates
import { redirect } from 'next/navigation'
export default function LegacyDatesRedirect() {
  redirect('/admin/market-dates')
}

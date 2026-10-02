// /admin → the Dropvine Direct admin. (This used to be the Dropvine Markets
// dashboard; Markets now runs as a separate site.)
import { redirect } from 'next/navigation'

export default function AdminIndex() {
  redirect('/admin/direct/drops')
}

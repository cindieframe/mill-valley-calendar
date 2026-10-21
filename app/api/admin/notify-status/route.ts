import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../../lib/adminAuth'
import { escapeLike } from '../../../lib/escapeLike'
import { eventStatusEmail, sendEmail } from '../../../lib/email'

// After an admin approves / rejects / unpublishes an event, email the submitter.
// Everything (recipient, status, note) is read from the database.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const { eventId } = await request.json().catch(() => ({}))
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const { data: ev } = await supabaseAdmin
    .from('events')
    .select('id, title, date, status, email, organization, town, rejected_note, unpublished_note')
    .eq('id', eventId)
    .maybeSingle()
  if (!ev) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!(await canManageTown(auth.admin, ev.town))) return forbiddenTown(ev.town)

  let to: string | null = ev.email || null
  if (!to && ev.organization) {
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('email')
      .ilike('name', escapeLike(ev.organization))
      .limit(1)
      .maybeSingle()
    to = org?.email || null
  }
  if (!to) return NextResponse.json({ sent: false, reason: 'No email on file' })

  const message = eventStatusEmail(to, ev)
  if (!message) return NextResponse.json({ sent: false, reason: `No email for status ${ev.status}` })

  const result = await sendEmail(message)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json({ sent: true })
}

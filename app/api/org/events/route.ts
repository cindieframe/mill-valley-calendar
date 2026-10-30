import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireOrgAccount } from '../../../lib/adminAuth'
import { eventSubmittedAdminEmail, eventSubmittedConfirmation, isEmail, sendEmail } from '../../../lib/email'

// Org dashboard → Add event. The org's name, town and verified flag come from
// its own organizations row; new events always start as pending.
const EDITABLE = [
  'title', 'date', 'time', 'end_time', 'location', 'address', 'category', 'tags',
  'cost', 'age', 'description', 'email', 'website', 'meeting_link', 'image_url',
  'contact_email',
] as const

export async function POST(request: NextRequest) {
  const auth = await requireOrgAccount(request)
  if (auth.response) return auth.response

  const body = await request.json().catch(() => ({}))
  const input = body?.event || {}
  if (!input.title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) {
    return NextResponse.json({ error: 'Title and date are required' }, { status: 400 })
  }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, name, town, email, verified')
    .eq('id', auth.org.id)
    .single()
  if (!org?.town) {
    return NextResponse.json({ error: 'Your organization has no town set. Contact townstir.admin@gmail.com.' }, { status: 400 })
  }

  const row: Record<string, any> = {}
  for (const key of EDITABLE) {
    const value = input[key]
    if (value !== undefined) row[key] = typeof value === 'string' ? value.slice(0, 10000) : value
  }
  row.title = String(input.title).trim()
  row.contact_email = isEmail(row.contact_email) ? String(row.contact_email).trim() : null
  row.organization = org.name
  row.town = org.town
  row.status = 'pending'
  row.verified = org.verified || false

  const { data: ev, error } = await supabaseAdmin.from('events').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sendEmail(eventSubmittedAdminEmail(ev, 0))
  if (org.email) await sendEmail(eventSubmittedConfirmation(org.email, ev, { greetingName: org.name }))

  // events.email is moved to the private event_contacts table on save; return the entered one.
  return NextResponse.json({ event: { ...ev, email: row.email ?? '' } })
}

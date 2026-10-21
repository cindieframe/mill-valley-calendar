import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { resolveTown } from '../../../lib/towns'
import { todayPT } from '../../../lib/dates'
import { verifyRecaptcha } from '../../../lib/recaptcha'
import { eventSubmittedAdminEmail, eventSubmittedConfirmation, isEmail, sendEmail } from '../../../lib/email'

// Public Post Event form. reCAPTCHA is verified here (a separate verify call
// from the browser could be skipped), the rows are written with the service
// key, and both emails are built server-side.
const FIELDS = [
  'title', 'time', 'end_time', 'location', 'address', 'meeting_link', 'organization',
  'category', 'tags', 'cost', 'age', 'description', 'email', 'website', 'image_url',
  'recurrence', 'recurrence_end', 'recurrence_count',
] as const
const MAX_DATES = 120

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { event, dates, recaptchaToken } = body || {}

  if (!(await verifyRecaptcha(recaptchaToken))) {
    return NextResponse.json({ error: 'reCAPTCHA verification failed. Please try again.' }, { status: 400 })
  }

  if (!event?.title?.trim() || !event?.organization?.trim() || !event?.location?.trim() || !event?.description?.trim()) {
    return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 })
  }
  const town = await resolveTown(event.town)
  if (!town) return NextResponse.json({ error: 'Please choose a town.' }, { status: 400 })

  const today = todayPT()
  const cleanDates: string[] = Array.from(new Set<string>(
    (Array.isArray(dates) ? dates : []).filter((d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
  )).sort()
  if (!cleanDates.length) return NextResponse.json({ error: 'A date is required.' }, { status: 400 })
  if (cleanDates.length > MAX_DATES) {
    return NextResponse.json({ error: `A series can have at most ${MAX_DATES} dates.` }, { status: 400 })
  }
  if (cleanDates[0] < today) return NextResponse.json({ error: 'The date is in the past.' }, { status: 400 })

  const base: Record<string, any> = {}
  for (const key of FIELDS) {
    const value = event[key]
    if (value !== undefined) base[key] = typeof value === 'string' ? value.slice(0, 10000) : value
  }
  base.title = String(event.title).trim()
  base.town = town
  base.recurrence_id = cleanDates.length > 1 ? randomUUID() : null

  // Only the first date shows in the admin pending queue; the rest are
  // 'pending_series' and get approved together with it.
  const rows = cleanDates.map((date, i) => ({ ...base, date, status: i === 0 ? 'pending' : 'pending_series' }))

  const { data: inserted, error } = await supabaseAdmin.from('events').insert(rows).select('id, title, date, organization, town').order('date')
  if (error || !inserted?.length) {
    console.error('Post Event insert failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  const first = inserted[0]
  await sendEmail(eventSubmittedAdminEmail(first, cleanDates.length - 1))
  if (isEmail(base.email)) {
    await sendEmail(eventSubmittedConfirmation(base.email, first, {
      recurrence: base.recurrence,
      totalDates: cleanDates.length,
    }))
  }

  return NextResponse.json({ success: true, id: first.id })
}

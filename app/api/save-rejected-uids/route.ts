import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../lib/adminAuth'

// Called before an admin deletes events: remembers their iCal UIDs so the
// sync never re-imports them.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const { eventIds } = await request.json()
  if (!Array.isArray(eventIds) || !eventIds.length) return NextResponse.json({ saved: 0 })

  const { data: events, error: loadError } = await supabaseAdmin
    .from('events')
    .select('ical_uid, organization, town')
    .in('id', eventIds)
    .not('ical_uid', 'is', null)
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!events?.length) return NextResponse.json({ saved: 0 })

  for (const town of Array.from(new Set(events.map(e => e.town)))) {
    if (!(await canManageTown(auth.admin, town))) return forbiddenTown(town)
  }

  const { error } = await supabaseAdmin
    .from('rejected_uids')
    .upsert(
      events.map(e => ({ ical_uid: e.ical_uid, organization: e.organization })),
      { onConflict: 'ical_uid', ignoreDuplicates: true }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saved: events.length })
}

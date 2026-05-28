import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const { eventIds } = await request.json()
  if (!eventIds?.length) return NextResponse.json({ saved: 0 })

  const { data: events } = await supabase
    .from('events')
    .select('ical_uid, organization')
    .in('id', eventIds)
    .not('ical_uid', 'is', null)

  if (!events?.length) return NextResponse.json({ saved: 0 })

  const { error } = await supabase
    .from('rejected_uids')
    .upsert(
      events.map(e => ({ ical_uid: e.ical_uid, organization: e.organization })),
      { onConflict: 'ical_uid', ignoreDuplicates: true }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saved: events.length })
}
import { createClient } from '@supabase/supabase-js'
import { buildIcs, icsFileName } from '../../../../lib/calendar'

// Serves a single event as an .ics file so it can be added to
// Apple Calendar, Outlook, or any other calendar app.
// GET /api/event/123/ics

export const dynamic = 'force-dynamic'

// Read-only, public data: the anon key is enough here (no writes).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: ev, error } = await supabase
    .from('events')
    .select('id, title, date, time, end_time, location, address, description, website, meeting_link, organization, town, status')
    .eq('id', id)
    .single()

  if (error || !ev || ev.status !== 'approved') {
    return new Response('Event not found', { status: 404 })
  }

  const ics = buildIcs(ev)

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${icsFileName(ev.title)}"`,
      // Events can be edited by admins, so don't let browsers keep a stale copy for long
      'Cache-Control': 'public, max-age=300',
    },
  })
}

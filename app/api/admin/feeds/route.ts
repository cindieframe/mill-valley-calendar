import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../../lib/adminAuth'
import { findTown, townFilter } from '../../../lib/towns'

// Lists every connected feed for a town — active and paused — with
// upcoming event counts, for the Connected feeds panel on Admin → Import.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const { town: rawTown } = await request.json()
  const town = await findTown(rawTown)
  if (!town) return NextResponse.json({ error: `Unknown town "${rawTown}"` }, { status: 400 })
  if (!(await canManageTown(auth.admin, town.name))) return forbiddenTown(town.name)

  const { data: feeds, error } = await supabaseAdmin
    .from('ical_feeds')
    .select('id, organization, url, town, active, last_synced, created_at')
    .or(townFilter(town))
    .order('organization')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  const countFor = async (feedId: number, status: string) => {
    const { count } = await supabaseAdmin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('feed_id', feedId)
      .eq('status', status)
      .gte('date', today)
    return count ?? 0
  }

  const withCounts = await Promise.all((feeds || []).map(async f => {
    const [approved, pending] = await Promise.all([countFor(f.id, 'approved'), countFor(f.id, 'pending')])
    return {
      ...f,
      town: town.name,
      source: /\?ical=1|\.ics|ical|calendarfeed/i.test(f.url) ? 'ical' : 'squarespace',
      upcoming: { approved, pending },
    }
  }))

  return NextResponse.json({ feeds: withCounts })
}

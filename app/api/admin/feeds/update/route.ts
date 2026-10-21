import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../../../lib/adminAuth'
import { resolveTown } from '../../../../lib/towns'

// Pause, resume, or move a connected feed to another town.
// Body: { id, action: 'pause' | 'resume' | 'set_town', town? }
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const { id, action, town: rawTown } = await request.json()
  if (!id || !['pause', 'resume', 'set_town'].includes(action)) {
    return NextResponse.json({ error: 'id and a valid action are required' }, { status: 400 })
  }

  const { data: feed, error: feedError } = await supabaseAdmin
    .from('ical_feeds')
    .select('id, organization, town, active')
    .eq('id', id)
    .single()
  if (feedError || !feed) return NextResponse.json({ error: 'Feed not found' }, { status: 404 })

  const currentTown = (await resolveTown(feed.town)) || feed.town
  if (!(await canManageTown(auth.admin, currentTown))) return forbiddenTown(currentTown)

  if (action === 'pause' || action === 'resume') {
    const active = action === 'resume'
    const { data, error } = await supabaseAdmin
      .from('ical_feeds')
      .update({ active })
      .eq('id', id)
      .select('id, organization, url, town, active, last_synced')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ feed: data })
  }

  // set_town: the feed and all of its upcoming events move together.
  const newTown = await resolveTown(rawTown)
  if (!newTown) return NextResponse.json({ error: `Unknown town "${rawTown}"` }, { status: 400 })
  if (!(await canManageTown(auth.admin, newTown))) return forbiddenTown(newTown)

  const { data, error } = await supabaseAdmin
    .from('ical_feeds')
    .update({ town: newTown })
    .eq('id', id)
    .select('id, organization, url, town, active, last_synced')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const { count, error: eventsError } = await supabaseAdmin
    .from('events')
    .update({ town: newTown }, { count: 'exact' })
    .eq('feed_id', id)
    .gte('date', today)
  if (eventsError) {
    return NextResponse.json({
      error: `Feed moved to ${newTown}, but its events could not be moved: ${eventsError.message}`,
    }, { status: 500 })
  }

  return NextResponse.json({ feed: data, eventsMoved: count ?? 0 })
}
